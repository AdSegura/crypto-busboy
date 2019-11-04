const path = require('path');
const uuid = require('uuid/v1');
const fs = require('fs');
const Helper = require('../lib/helper');
const Busboy = require('busboy');
const DetectorTimeout = require('../detector-timeout');
const BusFile = require('./busFile');
const Detector = require('../fileTypeDetector');
const FileExtensions = require('../file-extensions');
const {Base64Decode} = require('base64-stream');

const debug = require('debug')('cryptoBus:upload');
const debug_mode = require('debug')('cryptoBus:mode');
const debug_bus = require('debug')('cryptoBus:busboy');
const debug_bus_finish = require('debug')('cryptoBus:busboy:finish');
const debug_mime = require('debug')('cryptoBus:mime');

module.exports = class BusFile {

    constructor(file, filename, fieldname, folder, crypto_mode, detector_mode) {
        this.file = file;
        this.crypto_mode = crypto_mode;
        this.detector_mode = detector_mode;
        this.detector_finished = false;
        this.filename = filename;
        this.newname = BusFile.generateNewFileName(this.crypto_mode);
        this.fieldname = fieldname;
        this.ext = BusFile.setExtension(filename);
        this.folder = folder;
        this.error = null;
        this.writeable = Helper.is_writeStream(this.folder) ?
            this.folder.createWriteStream(this.fullName()) :
            fs.createWriteStream(this.fullPath());
    }

    start(){
        return new Promise((resolve, reject) => {
            this.busBoy.on('file', async (fieldname, file, filename, encoding, mimetype) => {
                debug_bus(`File [${fieldname}]: filename: ${filename}, encoding: ${encoding}, mimeType: ${mimetype}`);

                let cipher, detector, folder;

                /* on file new busFile **/
                const busFile = new BusFile(
                    file,
                    filename,
                    fieldname,
                    folder = this._getCryptoBusDestination(opt),
                    this._crypto_mode,
                    this._detection_mode
                );

                /* store in temp array file path **/
                this.filesToDisk.push(busFile.fullPath());

                /* fs writeableStream events **/
                busFile.writeable
                    .on('finish', this._writeable_finish_cb(busFile, resolve)) //TODO
                    .on('error', e => reject(e));

                /* cipher file ? **/
                if (this.crypto_mode) cipher = await this._getCipher();

                /* detector **/
                if (this._detection_mode) {
                    detector = this._getDetector();
                    detector
                        .detect() //TODO this finish after busFile.writeable.on-finish so error arise
                        .then(this._detector_type(busFile, resolve))
                        .catch(this._detector_type_err);
                }

                /* busboy file events **/
                busFile.file
                    .on('limit', this._file_limit(busFile, resolve))
                    .on('error', this._file_err(busFile, reject))
                    .on('end', this._file_end(busFile));

                /* pipe **/
                if (this._detection_mode && this._crypto_mode) {
                    debug_mode('DETECTION MODE && CRYPTO MODE');

                    if (encoding === 'base64')
                        busFile.file
                            .pipe(new Base64Decode())
                            .pipe(detector.stream())
                            .pipe(cipher.cipherStream)
                            .pipe(cipher.cipherStreamIV)
                            .pipe(busFile.writeable);
                    else
                        busFile.file
                            .pipe(detector.stream())
                            .pipe(cipher.cipherStream)
                            .pipe(cipher.cipherStreamIV)
                            .pipe(busFile.writeable);

                } else if (!this._detection_mode && this._crypto_mode) {
                    debug_mode('NO DETECTION MODE && CRYPTO MODE');

                    if (encoding === 'base64')
                        busFile.file
                            .pipe(new Base64Decode())
                            .pipe(cipher.cipherStream)
                            .pipe(cipher.cipherStreamIV)
                            .pipe(busFile.writeable);
                    else
                        busFile.file
                            .pipe(cipher.cipherStream)
                            .pipe(cipher.cipherStreamIV)
                            .pipe(busFile.writeable);

                } else if (this._detection_mode && !this._crypto_mode) {
                    debug_mode('DETECTION MODE && NO CRYPTO MODE');

                    if (encoding === 'base64')
                        busFile.file
                            .pipe(new Base64Decode())
                            .pipe(detector.stream())
                            .pipe(busFile.writeable);
                    else
                        busFile.file
                            .pipe(detector.stream())
                            .pipe(busFile.writeable);

                } else if (!this.detector_mode && !this.crypto_mode) {
                    debug_mode('NO DETECTION MODE && NO CRYPTO MODE');

                    if (encoding === 'base64')
                        busFile.file
                            .pipe(new Base64Decode())
                            .pipe(busFile.writeable);
                    else
                        busFile.file
                            .pipe(busFile.writeable);
                }
            });
        });
    }

    /**
     * Get new Detector
     *
     * @return {FileTypeDetector|*}
     * @private
     */
    _getDetector() {
        return new Detector;
    }

    fullName() {
        return `${this.newname}.${this.ext}`
    }

    fullPath() {
        if(typeof this.folder === 'string')
            return path.join(this.folder, this.fullName());


        return (this.get_folder()).replace(/\/$/,'') + '/' + this.fullName();
    }

    get_folder(){
        if(typeof this.folder === 'string')
            return this.folder;

        if(Helper.is_writeStream(this.folder))
            if(this.folder.path) return this.folder.path;

            return 'stream://';
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

    /**
     * detector error event callback
     *
     * @param e
     * @return {Promise<never>}
     * @private
     */
    _detector_type_err(e) {
        return Promise.reject(e)
    };

    /**
     * busFile.file limit bytes event callback
     *
     * @param busFile
     * @param resolve
     * @return {Function}
     * @private
     */
    _file_limit(busFile, resolve) {
        return () => {
            debug_bus(`bytes limit ${this.opt.limits.fileSize} exceeded on File: ${busFile.filename}`);
            busFile.error = `BYTES LIMIT EXCEEDED, limit ${this.opt.limits.fileSize} bytes`;
            busFile.file.resume(); //fires finish
            BusFile._deleteFailed(busFile.fullPath());
            if (this.busboy_finished)
                return this._closeReq(resolve);
        }
    };


    /**
     * busFile.file error event callback
     *
     * @param busFile
     * @param reject
     * @return {function(*): *}
     * @private
     */
    _file_err(busFile, reject) {
        return (e) => {
            debug_bus(`File ON ERROR [ ${busFile.filename} ] ERROR ->  ${e}`);
            busFile.error = `BUSBOY ERROR ${e.message}`;
            return reject(busFile)
        }
    };

    /**
     * fs writeableStream finish event callback
     *
     * @param busFile
     * @param resolve
     * @return {Function}
     * @private
     */
    _writeable_finish_cb(busFile, resolve) {
        return () => {
            debug_bus_finish(`_writeable_finish_cb busboy | busboy finished? ${this.busboy_finished}`);
            debug_bus_finish(`_writeable_finish_cb busboy | DETECTION finished? ${this.detector_finished}`);
            if (busFile.detector_mode && !this.detector_finished) {
                console.log('Detector mode ON, detector NOT finished ', busFile);
                return;
            }
            if (this.busboy_finished) {
                process.nextTick(() => {
                    Upload._removeListeners(busFile.writeable);
                    Upload._removeListeners(busFile.file);
                    return this._closeReq(resolve);
                })
            } /*else {
                process.nextTick(() => {
                    debug_bus('_writeable_finish_cb busboy not finished NEXTTICK');
                    return this._writeable_finish_cb(busFile, resolve)();
                })
            }*/
        }
    };

    /**
     * detector type event callback
     *
     * @param busFile
     * @param resolve
     * @return {Function}
     * @private
     */
    _detector_type(busFile, resolve) {
        return (type) => {
            this.detector_finished = true;
            if (!type || !this._allowedExtensions(type.ext)) {
                busFile.error = `EXTENSION NOT ALLOWED ${busFile.ext}`;
                debug_mime(`ERROR MUST BE INCLUDED: EXTENSION NOT ALLOWED ${busFile.ext}`);
                process.nextTick(() => {
                    busFile.file.resume();
                    Upload._deleteFailed(busFile.fullPath());
                    if (this.busboy_finished)
                        return this._closeReq(resolve);
                });
            }
        }
    };



    /**
     * busFile.file finish event callback
     *
     * @param busFile
     * @return {Function}
     * @private
     */
    _file_end(busFile) {
        return () => {
            this.files.push(busFile.toJson());
            debug_bus(`File ON END [ ${busFile.filename} ] Finished`);
        }
    };

    /**
     * get where the file is going to be stored
     *
     * @param opt
     * @return {*}
     * @private
     */
    _getCryptoBusDestination(opt) {
        let dest;
        if (opt && typeof opt === 'object') {
            if (opt.dest)
                dest = opt.dest
        } else {
            dest = this.opt.dest;
        }
        return dest;
    }

    /**
     * Allowed Extensions Check
     *
     * @param ext
     * @return {boolean}
     * @private
     */
    _allowedExtensions(ext) { //TODO FIX edge case checking this.options.limits.allowed
        if (this._checkExtension(ext)) {
            debug_mime("checkExtension allow ---> ", ext);
            return true;
        } else {
            debug_mime('Rejected file of type ', ext);
            return false;
        }
    }

    /**
     * Check if extension is allowed
     *
     * @param extension
     * @return {boolean}
     * @private
     */
    _checkExtension(extension) {
        debug_mime('checkExtension extension --> ', extension);
        debug_mime('checkExtension extensions --> ', this.opt.limits.allowed);
        return (this.opt.limits.allowed.indexOf(FileExtensions.normalizeExtensions(extension)) >= 0);
    }

    /**
     * get cipher streams
     *
     * @return {Promise<{cipherStreamIV, cipherStream}>}
     * @private
     */
    async _getCipher() {
        return await this.cipher.getCipherStreams();
    }


};
