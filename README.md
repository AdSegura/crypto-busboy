# crypto-busboy
Upload and download files from nodejs using streams.

Optional you can cipher all incoming files, and decipher for download, without storing any clear version of the files.

All data manipulation is done using streams.  

This module is based on [busboy upload module](https://github.com/mscdex/busboy) 

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

                res.json(r)
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
                
                res.json(r)
            })
            .catch(e => {
                next(e)
            })
    }
```
# Tests
Test will download some files from a repo and generate a 3GB file that will be removed after tests finish

```bash
> npm run test
```

### Dependencies
* [busboy](https://github.com/mscdex/busboy)
* [file-type](https://github.com/sindresorhus/file-type)
* [mime](https://github.com/broofa/node-mime#readme)
* [mime-stream](https://github.com/meyfa/mime-stream)
* [mkdirp](https://github.com/substack/node-mkdirp#readme)
* [uuid](https://github.com/kelektiv/node-uuid#readme)

### Contributing
Pull requests are welcome.

### License
[MIT](https://choosealicense.com/licenses/mit/)
