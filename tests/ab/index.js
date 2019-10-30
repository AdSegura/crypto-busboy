let file_to_test;
if (process.argv.includes('-ft')) {
    file_to_test = process.argv[process.argv.indexOf('-ft') + 1];
    console.log('file_to_test', file_to_test);
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

server.listen();

const md5_hash = md5File.sync(file_to_test);

generate_ab
    .generate(file_to_test)
    .then(file => {
        ab
            .test(1, 1, file, server.address().port)
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
                    console.log(file);
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
    server.close();
}
