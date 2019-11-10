process.env.NODE_ENV = 'test';
const path = require('path');
const Helper = require('../lib/helper');

let file_to_test;
let requests = 1;
let concurrent = 1;
let upload_options = {
    dest: Helper.getUploadServerFolder(),
};

if (process.argv.includes('-ft') && process.argv.includes('-conf')) {

    file_to_test = process.argv[process.argv.indexOf('-ft') + 1];
    const confile = process.argv[process.argv.indexOf('-conf') + 1];
    upload_options = Object.assign({}, upload_options, require(path.resolve(confile)));
    console.log(upload_options);
    if (process.argv.includes('-n'))
        requests = process.argv[process.argv.indexOf('-n') + 1];
    if (process.argv.includes('-c'))
        concurrent = process.argv[process.argv.indexOf('-c') + 1];

} else {
    console.error('-ft, --conf missing [allowed|cipher|cipher_allowed|default]');
    process.exit(-1);
}

const ab = require('./ab');
const generate_ab = require('./generate_ab_file');
const Server = require('../server');
/*const upload_options_cipher = {key: 'da-password', dest: Helper.getUploadServerFolder()};
const upload_options_default = {dest: Helper.getUploadServerFolder()};
const upload_options_detector = {
    dest: Helper.getUploadServerFolder(),
    limits:{
        allowed: ['jpg', 'png'],
        size: 1024 * 1024
    }};*/
const server = new Server(null, upload_options);
const Downloader = require('./downloader');
const md5File = require('md5-file');
const fs = require('fs');
const assert = require('assert').strict;
const uuid = require('uuid/v1');
const os = require('os');
const dest = `${os.tmpdir()}/test-${uuid()}`;
let ab_file_generated;

server.listen();

const md5_hash = md5File.sync(file_to_test);

generate_ab
    .generate(file_to_test)
    .then(file => {
        ab_file_generated = file;
        ab
            .test(requests, concurrent, file, server.address().port)
            .then((code, data) => {
                //console.log(data.includes(''));
                download(dest, server.address().port)
            })
    });

function download(dest, port) {
    const down = new Downloader(dest, port);
    down
        .dec()
        .then(data => {
            if(data) return finish(dest, data);
            Helper.readDir(dest, (e, files) => {
                console.log('Downloaded ' + files.length + ' files... now testing md5');
                let i = files.length;
                if(i === 0 )  return finish(dest);
                files.forEach((file) => {
                    md5File(file, (e, md5) => {
                        if (e) throw e;
                        assert.deepStrictEqual(md5, md5_hash);
                        fs.unlinkSync(file);
                        i -= 1;
                        if (i <= 0) return finish(dest);
                    })
                });
            })
        })
}

function finish(dest, data) {
    if(data) console.log(data);
    console.log('\ntest finished with this options:');
    console.table(upload_options);
    //fs.rmdirSync(dest);
    //fs.unlinkSync(ab_file_generated);
    server.close();
}
