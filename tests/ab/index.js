process.env.NODE_ENV = 'test';

let file_to_test;
let requests = 1;
let concurrent = 1;
if (process.argv.includes('-ft')) {
    file_to_test = process.argv[process.argv.indexOf('-ft') + 1];
    if (process.argv.includes('-n'))
        requests = process.argv[process.argv.indexOf('-n') + 1];
    if (process.argv.includes('-c'))
        concurrent = process.argv[process.argv.indexOf('-c') + 1];
} else {
    console.error('-ft');
    process.exit(-1);
}

const Helper = require('../lib/helper');
const ab = require('./ab');
const generate_ab = require('./generate_ab_file');
const Server = require('../server');
const upload_options = {key: 'da-password', dest: Helper.getUploadServerFolder()};
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
            .then(code => download(dest, server.address().port))
    });

function download(dest, port) {
    const down = new Downloader(dest, port);
    down
        .dec()
        .then(() => {
            Helper.readDir(dest, (e, files) => {
                console.log('Downloaded ' + files.length + ' files... now testing md5');
                let i = files.length;
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

function finish(dest) {
    console.log('test finished...');
    fs.rmdirSync(dest);
    fs.unlinkSync(ab_file_generated);
    server.close();
}
