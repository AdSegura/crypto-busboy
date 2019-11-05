const Helper = require('../lib/helper');
const uuid = require('uuid/v1');
const path = require('path');
const fs = require('fs');
const debug = require('debug')('cryptoBus:file');


module.exports = class File {
    constructor(filename, fieldname, folder, crypto_mode, detector_mode){
        this.filename = filename;
        this.fieldname = fieldname;
        this.folder = folder;
        this.ext =  File.setExtension(this.filename);
        this.newname =  File.generateNewFileName(crypto_mode);
        this.error = null;
        this.crypto_mode = crypto_mode;
        this.detector_mode = detector_mode;
        this.finished_detector =  !this.detector_mode;
        this.writeable =  Helper.is_writeStream(this.folder) ?
                this.folder.createWriteStream(this.fullName()) : fs.createWriteStream(this.fullPath());
        //debug('FILE CLASS' , this)
    }

    toJson() {
        return {
            filename: this.filename,
            fullname: this.fullName(),
            newname: this.newname,
            fieldname: this.fieldname,
            ext: this.ext,
            folder: this.get_folder(),
            fullPath: this.fullPath(),
            error: this.error
        }
    }

    get_folder() {
        if (typeof this.folder === 'string')
            return this.folder;

        if (Helper.is_writeStream(this.folder))
            if (this.folder.path) return this.folder.path;

        return 'stream://';
    }

    fullName() {
        return `${this.newname}.${this.ext}`
    }

    fullPath() {
        if (typeof this.folder === 'string')
            return path.join(this.folder, this.fullName());


        return (this.get_folder()).replace(/\/$/, '') + '/' + this.fullName();
    }

    /**
     * Generate new uuid/v1 file name based on crypto_mode
     *
     * @param crypto_mode {boolean}
     * @return {string}
     */
    static generateNewFileName(crypto_mode) {
        if (crypto_mode)
            return `${uuid()}-ciphered`;
        return uuid();
    }

    /**
     * splitNameToExtension
     * foo.jpg -> .jpg
     * foo -> .filext
     * @param {*} filename
     */
    static setExtension(filename) {
        debug('setExtension', filename)
        const ext = path.extname(filename || '').split('.');
        return ext[ext.length - 1] === '' ? 'filext' : ext[ext.length - 1];
    }

}