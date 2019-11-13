[![Build Status](https://travis-ci.org/AdSegura/crypto-busboy.svg?branch=master)](https://travis-ci.org/AdSegura/crypto-busboy)
[![node version](https://badgen.net/badge/node/%3E=10.16.3/green)](https://badgen.net/badge/node/%3E=10.16.3/green)
[![npm version](https://badge.fury.io/js/crypto-busboy.svg)](https://badge.fury.io/js/crypto-busboy)

# crypto-busboy
Upload and download files from nodejs using streams.

Optional you can cipher all incoming files, and decipher for download, without storing any clear version of the files.

All data manipulation is done using streams.

This module can limit upload on:
* file size (busBoy)
* files count (busBoy)
* file extension (sniffing file header not assuming mime headers that can be faked)  

File extension detection only works with this extensions [`file-type module` extensions support](https://github.com/sindresorhus/file-type#supported-file-types)

This module is based on [busboy upload module](https://github.com/mscdex/busboy) 

# Install 
```sh
> npm i crypto-busboy
```

# Features
* upload files with busboy size limits and file count limit, (basic BusBoy usage)
* upload only files with allowed extension [`file-type module` extensions support](https://github.com/sindresorhus/file-type#supported-file-types).
* option to cipher incoming files before storing to disk.
* download ciphered files without storing any clear version of the file.  

## Prerequisites
* NodeJs `>=v10.16.3 (npm v6.9.0)`

# Use
## CryptoBusBoy Options
```js
const options = {
    dest: 'folder where to put uploads',
    key: 'super-password', // optional, if you don't want to cipher files delete this
    alg: 'aes256', // optional default to aes-256-cbc
    timeOut: 2000, // optional request timeout, default option 5sg  
    limits: { //optional limits
        fileSize: 2000 * 1024 * 1024,
        files: 3,
        allowed: ['jpg', 'png']
    }
}
```

#### options.dest
* `dest:` can be a local path `/foo/bar`
* `dest:` can be an object with `createWriteStream` method exposing your custom writeable stream

```js
 const dest =  {
                createWriteStream: (filename) => {
                    const dir = '/tmp/uptest';
                    return fs.createWriteStream(dir + '/' + filename)
                }
            };
```

#### options.key
Optional param, if you want to cipher uploads you must provide a password.
#### options.alg
Optional param, default alg `aes-256-cbc`.
#### options.timeOut
By default if a client start to upload a file and there is no incoming data in 5 seconds,
cryptoBusBoy will assume the upload is broken and will tag the upload session as failed 
releasing all resources.

If you are dealing with very unstable clients You can increase timeOut value as you wish.
#### options.limits
Optional param.

Limits 
* fileSize limit in bytes.
* files limit, number of files allowed to Upload
* file-type limit will limit files by mime type.

### express example
```js
const cryptoBusBoy = new CryptoBusBoy(options);
 
function uploadFiles(req, res, next){
        cryptoBusBoy.upload(req)
            .then(r => {
                if(r.warnings.length > 0)
                    res.statusCode = 429;
                else if (r.files.length > 0 && r.errors.length > 0)
                    res.statusCode = 429;
                else if (r.errors.length > 0)
                    res.statusCode = 400;
                
                if(r.files.length > 0)
                    saveto_db(r.files)
                        .then(() => res.json(r.files.map(f => f.filename)))
                        .catch(e => next(e));
                else
                    res.json(r);
            })
            .catch(e => next(e))
    }

function downloadFile(req, res, next){
        const file = req.params.file;
        cryptoBusBoy.download(req, res, next, file);
        //or if you are using req.params.file you can directly use
        // cryptoBusBoy.download(req, res, next);
    }

function uploadFilesCustomOpt(req, res, next){
        const force_path = busOpt.dest + '/foo/';
        const dest_opt = {dest: force_path};

        cryptoBusBoy.upload(req, dest_opt)
            .then(r => {
                if(r.warnings.length > 0)
                    res.statusCode = 429;
                else if (r.files.length > 0 && r.errors.length > 0)
                    res.statusCode = 429;
                else if (r.errors.length > 0)
                    res.statusCode = 400;

                if(r.files.length > 0)
                    saveto_db(r.files)
                        .then(() => res.json(r.files.map(f => f.filename)))
                        .catch(e => next(e));
                else
                    res.json(r)
            })
            .catch(e => {
                next(e)
            })
    }
```

## Upload output
**Upload f4.jpeg with form field `avatar = true`**

```json
{
    "warnings":[],
    "errors":[],
    "files":[
        {
            "filename":"f4.jpeg",
            "fullname":"4541a890-f451-11e9-afca-ef6fa948a376-ciphered.jpeg",
            "newname":"4541a890-f451-11e9-afca-ef6fa948a376-ciphered",
            "fieldname":"my photo 4",
            "ext":"jpeg",
            "folder":"/crypto-upload/tests/files",
            "fullPath":"/crypto-upload/tests/files/4541a890-f451-11e9-afca-ef6fa948a376-ciphered.jpeg",
            "error":null,
            "finished": true,
            "failed": false,
            "size": 32606
        }
    ],
   "fields":[{"avatar":"true"}]}
```
**Upload not allowed extension file `xsl`**

```json
{
  "warnings":[],
  "errors":
    [{
        "filename":"f1.xlsx",
        "fullname":"45463c70-f451-11e9-afca-ef6fa948a376-ciphered.xlsx",
        "newname":"45463c70-f451-11e9-afca-ef6fa948a376-ciphered",
        "fieldname":"my excel",
        "ext":"xlsx",
        "folder":"/crypto-upload/tests/files",
        "fullPath":"/crypto-upload/tests/files/45463c70-f451-11e9-afca-ef6fa948a376-ciphered.xlsx",
        "error":"EXTENSION NOT ALLOWED xlsx"
    }],
  "files":[],
  "fields":[]
}
```
**Upload 5 files limit is 2, Ok two files and get warning = `MAX FILES REACHED`**
```json
{
"warnings": [ "MAX FILES REACHED, LIMIT IS 2 FILES" ],
"files": [
    {
      "filename": "f2.jpeg",
      "fullname": "bd87cd00-04ca-11ea-a94b-e3abd7553c43-ciphered.jpeg",
      "newname": "bd87cd00-04ca-11ea-a94b-e3abd7553c43-ciphered",
      "fieldname": "my photo 2",
      "encoding": "7bit",
      "mimetype": "image/jpeg",
      "crypto_mode": true,
      "detector_mode": true,
      "ext": "jpeg",
      "folder": "/crypto-busboy/tests/files",
      "fullPath": "/crypto-busboy/tests/files/bd87cd00-04ca-11ea-a94b-e3abd7553c43-ciphered.jpeg",
      "error": null,
      "finished": true,
      "failed": false,
      "size": 32606
    },
    {
      "filename": "f3.jpeg",
      "fullname": "bd89efe0-04ca-11ea-a94b-e3abd7553c43-ciphered.jpeg",
      "newname": "bd89efe0-04ca-11ea-a94b-e3abd7553c43-ciphered",
      "fieldname": "my photo 3",
      "encoding": "7bit",
      "mimetype": "image/jpeg",
      "crypto_mode": true,
      "detector_mode": true,
      "ext": "jpeg",
      "folder": "/crypto-busboy/tests/files",
      "fullPath": "/crypto-busboy/tests/files/bd89efe0-04ca-11ea-a94b-e3abd7553c43-ciphered.jpeg",
      "error": null,
      "finished": true,
      "failed": false,
      "size": 66860
    }
  ],
  "fields": [],
  "errors": []
}
```

**`Debug=cryptoBus:*`**
```sh
> DEBUG=cryptoBus:* npm run test
```
# Tests
Test will download some files from a repo and generate a ~~2GB~~ 50mb file that will be removed after tests finish

`--big_file_size` [mb|gb]

```bash
> npm run test
> NODE_ENV=test mocha --exit --big_file_size '50mb' tests/
```

### AB Stress Upload Tests
You need to have installed **AB - Apache HTTP server benchmarking tool**

For test uploads with [AB](https://httpd.apache.org/docs/2.4/programs/ab.html) 
we need to base64 encode the file we are uploading,
so instead of a binary stream we have a base64 data stream at the server.

Tests results will be increased against a typical browser upload because at the server we need 
to base64Decode the incoming stream before doing anything else with the file.

**Run AB tests**
* `-ft` file to transform to ab format and test
* `-n`  number of requests
* `-c`  concurrent requests
* `-conf` tests/server/conf/cipher_allowed.json|default.json|allowed.json|cipher.json

You can pass any json representing crypto-busboy options.

```bash
➜ node tests/ab -ft file.zip -c 10 -n 100 -conf tests/server/conf/cipher_allowed.json
```

The above command will:
* start express server with crypto-busboy options `cipher_allowed.json`
* Upload file.zip `100` times in bunches of `10` using AB tool.
* Present AB results. 
* Download all 100 files to a temp location.
* md5-check to verify that the file we uploaded is the same we downloaded.
* Clean up everything.

if you keep a file to test upload that do not pass limits detector you will be notified.

### Dependencies
* [busboy](https://github.com/mscdex/busboy)
* [file-type](https://github.com/sindresorhus/file-type)
* [mime](https://github.com/broofa/node-mime#readme)
* [mime-stream](https://github.com/meyfa/mime-stream)
* [mkdirp](https://github.com/substack/node-mkdirp#readme)
* [uuid](https://github.com/kelektiv/node-uuid#readme)
* [base64-stream](https://github.com/mazira/base64-stream#readme)

### Contributing
Pull requests are welcome.

### License
[MIT](https://choosealicense.com/licenses/mit/)
