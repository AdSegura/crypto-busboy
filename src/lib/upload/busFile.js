const path = require('path');
const uuid = require('uuid/v1');
const fs = require('fs');

module.exports = class BusFile {

    constructor(file, filename, fieldname, folder, crypto_mode) {
        this.file = file;
        this.crypto_mode = crypto_mode;
        this.filename = filename;
        this.newname = BusFile.generateNewFileName(this.crypto_mode);
        this.fieldname = fieldname;
        this.ext = BusFile.setExtension(filename);
        this.folder = folder;
        this.error = null;
        this.writeable = fs.createWriteStream(this.fullPath());
    }

    fullName() {
        return `${this.newname}.${this.ext}`
    }

    fullPath() {
        return path.join(this.folder, this.fullName());
    }

    toJson() {
        return {
            filename: this.filename,
            fullname: this.fullName(),
            newname: this.newname,
            fieldname: this.fieldname,
            ext: this.ext,
            folder: this.folder,
            fullPath: this.fullPath(),
            error: this.error
        }
    }

    /**
     * Generate new uuid/v1 file name based on crypto_mode
     *
     * @param crypto_mode {boolean}
     * @return {string}
     */
    static generateNewFileName(crypto_mode){
        if(crypto_mode)
            return `${uuid()}-ciphered`;
        return uuid();
    }

    /**
     * splitNameToExtension
     * foo.jpg -> .jpg
     * foo -> .filext
     * @param {*} filename
     */
    static setExtension(filename){
        const ext = path.extname(filename || '').split('.');
        return ext[ext.length - 1] === '' ? 'filext' : ext[ext.length - 1];
    }
};
