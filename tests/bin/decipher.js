const Helper = require('../lib/helper');
const path = require('path');
const http = require("http");
const fs = require('fs');
const mkdirp = require('mkdirp');


class Decipher {
    constructor(dest) {
        this.dest = dest;
        this.folder = Helper.getUploadServerFolder();
    }

    dec() {
        return new Promise((resolve, reject) => {
            let i;
            this.readFolder(this.folder, (e, files) => {
                i = files.length - 1;
                files.forEach(file => {
                    if (path.basename(file) === '.gitignore') return;
                    this.download(file, () => {
                        //console.log('download...');
                        fs.unlink(file, () => {
                            i -= 1;
                            if(i <= 0) return resolve();
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
        http.get('http://localhost:3000/file/' + path.basename(file), res => {
            res.pipe(fs.createWriteStream(this.dest + '/' + path.basename(file))).on('finish', cb)
        })
    }
};

if (process.argv.includes('-d')) {
    const destPos = process.argv.indexOf('-d') + 1;
    const dest = process.argv[destPos];
    mkdirp.sync(dest);
    const decipher = new Decipher(dest);

    decipher.dec()
        .then(() => {
            console.log('finish...');
                Helper.readDir(dest, (e, files) => {
                    files.forEach((file) => {
                        console.log(file);
                        fs.unlinkSync(file);
                    });
            })
        })

} else {
    module.exports = Decipher;
}
