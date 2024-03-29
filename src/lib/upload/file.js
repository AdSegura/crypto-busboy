const Helper = require('../lib/helper');
const uuid = require('uuid/v1');
const path = require('path');
const fs = require('fs');
const debug = require('debug')('cryptoBus:file');
module.exports = class File {

    constructor(fieldname, file, filename, encoding, mimetype, folder, crypto_mode, detector_mode){
        this.file = file;
        this.size = 0;
        this.filename = filename;
        this.fieldname = fieldname;
        this.folder = folder;
        this.encoding = encoding;
        this.mimetype = mimetype;
        this.ext =  File.setExtension(this.filename);
        this.newname =  File.generateNewFileName(crypto_mode);
        this.error = null;
        this.finished = false;
        this.writeable_finished = false;
        this.failed = false;
        this.crypto_mode = crypto_mode;
        this.detector_mode = detector_mode;
        this.finished_detector =  !this.detector_mode;
        this.writeable = null;
        this.write_stream = null;
        this.remote_http = false;
        this.got_http_remote_res = false;

        if(Helper.is_writeStream(this.folder))
            this.writeable = () => {
                if(this.folder.protocol === 'http') this.remote_http = true;
                if(this.write_stream) return this.write_stream;
                this.write_stream = this.folder.createWriteStream(this.fullName());
                return this.write_stream;
            };
        else
            this.writeable = () => {
                if(this.write_stream) return this.write_stream;
                this.write_stream = fs.createWriteStream(this.fullPath());
                return this.write_stream;
            };
    }

    /**
     * toJson
     *
     * @return File
     */
    toJson() {
        return {
            filename: this.filename,
            fullname: this.fullName(),
            newname: this.newname,
            fieldname: this.fieldname,
            encoding: this.encoding,
            mimetype: this.mimetype,
            crypto_mode:this.crypto_mode,
            detector_mode: this.detector_mode,
            ext: this.ext,
            folder: this.get_folder(),
            fullPath: this.fullPath(),
            error: this.error,
            finished: this.finished,
            failed: this.failed,
            size: this.size
        }
    }

    /**
     * get_folder
     *
     * @return {string|*}
     */
    get_folder() {
        if (typeof this.folder === 'string')
            return this.folder;

        if (Helper.is_writeStream(this.folder))
            if (this.folder.path) return this.folder.path;

        return 'stream://';
    }

    /**
     * fullName
     * @return {string}
     */
    fullName() {
        return `${this.newname}.${this.ext}`
    }

    /**
     * fullPath
     * @return {string}
     */
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
        debug('setExtension', filename);
        const ext = path.extname(filename || '').split('.');
        return ext[ext.length - 1] === '' ? 'filext' : ext[ext.length - 1];
    }

    /**
     * Remove listeners
     */
    remListeners(){
        Helper.remlisteners(this.write_stream);
        Helper.remlisteners(this.file);
    }
}
