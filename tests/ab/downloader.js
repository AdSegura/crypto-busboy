const is_script = !module.parent;
const Helper = require('../lib/helper');
const path = require('path');
const http = require("http");
const fs = require('fs');
const mkdirp = require('mkdirp');
const md5file = require('md5-file');
const md5_hash = '0045f4c2a16ba5651f6e26139805d5b2';
const assert = require('assert').strict;

class Downloader {
    constructor(dest, port) {
        mkdirp.sync(dest);
        this.dest = dest;
        this.port = port;
        this.folder = Helper.getUploadServerFolder();
    }

    dec() {
        return new Promise((resolve, reject) => {
            let i;
            this.readFolder(this.folder, (e, files) => {
                i = files.length - 1;
                if(i === 0 ) return resolve('no files downloaded..., test pass but you pick a file that did not pass limits');
                files.forEach(file => {
                    if (path.basename(file) === '.gitignore') return;
                    this.download(file, () => {
                        fs.unlink(file, () => {
                            i -= 1;
                            if (i <= 0) return resolve();
                        })
                    });
                });
            })
        })
    }

    readFolder(folder, cb) {
        return Helper.readDir(folder, cb);
    }

    download(file, cb) {
        http.get(`http://localhost:${this.port}/file/${path.basename(file)}`, res => {
            res.pipe(fs.createWriteStream(this.dest + '/' + path.basename(file))).on('finish', cb)
        })
    }
};

if (is_script) {
    if (process.argv.includes('-d')) {
        const dest = process.argv[process.argv.indexOf('-d') + 1];
        const decipher = new Downloader(dest, 3000);

        decipher.dec()
            .then(() => {
                Helper.readDir(dest, (e, files) => {
                    console.log('Downloaded ' + files.length + ' files... now testing md5');
                    let i = files.length;
                    files.forEach((file) => {
                        md5file(file, (e, md5) => {
                            if (e) throw e;
                            assert.deepStrictEqual(md5, md5_hash);
                            fs.unlinkSync(file);
                            i -= 1;
                            if (i <= 0) console.log('test finished');
                        })
                    });
                })
            });
    }
} else {
    module.exports = Downloader;
}
