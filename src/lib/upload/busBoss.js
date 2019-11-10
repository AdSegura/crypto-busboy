const fs = require('fs');
const DetectorTimeout = require('../detector-timeout');
const FileExtensions = require('../file-extensions');
const {Base64Decode} = require('base64-stream');
const debug = require('debug')('cryptoBus:busFile');
const debug_mode = require('debug')('cryptoBus:mode');
const debug_bus = require('debug')('cryptoBus:busboy');
const debug_bus_finish = require('debug')('cryptoBus:busboy:finish');
const debug_mime = require('debug')('cryptoBus:mime');
const debug_bfile = require('debug')('cryptoBus:onFile');
const File = require('./file');
const fileType = require('file-type');

module.exports = class BusBoss {

    constructor(opt, crypto_mode, detector_mode, cipher) {
        this.opt = Object.assign({}, opt);
        this.response = {
            files: [],
            fields: [],
            errors: [],
            warnings: [],
        };
        this.filesToDisk = [];
        this.crypto_mode = crypto_mode;
        this.detector_mode = detector_mode;
        this.folder = this._getCryptoBusDestination(this.opt);
        this.error = null;
        this.detectorTimeout = new DetectorTimeout(opt);
        this.cipher = cipher;
        this.busboy_finished = false;

        this['reactor'] = Symbol('reactor');
        //debug('BUS-FILE CLASS' , this)
    }

    /**
     * field event callback
     *
     * @return {Function}
     * @private
     */
    _field_cb() {
        return (fieldname, val) => {
            debug_bus('BusBoy ON FIELD, ', fieldname, val);
            if (fieldname === 'Content-Type') return;
            this.response.fields.push({[fieldname]: val});
        }
    };

    /**
     * BusBoy Error event callback
     *
     * @return {Function}
     * @private
     */
    _bb_error(resolve) {
        return (e) => {
            debug_bus('busboy Error', e);
            this.response.errors.push(e.message);
            this.detectorTimeout.clearDetector();
            this.filesToDisk.forEach(failed => {
                BusBoss._deleteFailed(failed);
            });
            return this._return(resolve);
        }
    };

    /**
     * return Promise with errors, warnings, files uploaded
     *
     * @private
     */
    _return(resolve) {
        debug_bus_finish('BusBoss finish with response -> ', this.response);
        return resolve(this.response);
    }

    /**
     * detector timeOut callback
     *
     * @param reject
     * @return {function(*=): *}
     * @private
     */
    _detector_timeout(reject) {
        return (err) => {
            if (!err) return;
            debug_mime('TIMEOUT DELETE ALL FAILED', this.filesToDisk);
            this.filesToDisk.forEach(failed => {
                BusBoss._deleteFailed(failed);
            });
            return reject(err);
        }
    };

    /**
     * Delete failed Files
     *
     * @param {*} file
     * @private
     */
    static _deleteFailed(file) {
        debug('deleteFailed -> DELETING FILE -> ', file);
        fs.unlink(file, (err) => {
            if (err) {
                if (process.env.NODE_ENV === 'test') return;
                console.error(err);
            }
        });
    }

    /**
     * start upload
     *
     * @param req
     * @param busBoy
     * @param folder
     * @return {Promise<unknown>}
     */
    start(req, busBoy, folder) {
        return new Promise((resolve, reject) => {
            debug_bus('Start Busboy Core');
            debug_bus('Folder', folder);

            this.detectorTimeout.detect_timeout(this._detector_timeout(reject));

            /* busboy events **/
            busBoy
                .on('field', this._field_cb())
                .on('filesLimit', () => {
                    debug_bus('MAX FILES REACHED, LIMIT IS: ', this.opt.limits.files);
                    this.response.warnings.push(`MAX FILES REACHED, LIMIT IS ${this.opt.limits.files} FILES`);
                })
                .on('error', this._bb_error(resolve))
                .on('finish', () => {
                    debug_bus('busboy finish parsing form!');
                    this.busboy_finished = true;
                });

            /* pipe request to busboy through detectorTimeout **/
            req
                .pipe(this.detectorTimeout)
                .pipe(busBoy)
                .on('error', reject)
                .on('finish', () => {
                    this.detectorTimeout.clearDetector();
                    debug_bus_finish('FINISH REQUEST');
                });

            busBoy.on('file', this._onFile(folder, resolve, reject));
        });
    }

    /**
     * busboy onFile event
     *
     * @param folder
     * @param resolve
     * @param reject
     * @return {Function}
     * @private
     */
    _onFile(folder, resolve, reject){
        return async (fieldname, file, filename, encoding, mimetype) => {
            debug_bus(`File [${fieldname}]: filename: ${filename}, encoding: ${encoding}, mimeType: ${mimetype}`);

            let cipher, file_type;
            /* on file new busFile **/
            const bfile = new File(
                fieldname,
                file,
                filename,
                encoding,
                mimetype,
                folder,
                this.crypto_mode,
                this.detector_mode
            );

           /* if (this.detector_mode){
                this['reactor'] = await fileType.stream(bfile.file);
            } else {
                this['reactor'] = bfile.file;
            }*/

            this.filesToDisk.push(bfile.fullPath());

            /* fs writeableStream events **/
            bfile.writeable
                .once('finish', () => {
                    this.response.files.push(bfile.toJson());
                    process.nextTick(() => {
                        bfile.remListeners();
                        if (this.busboy_finished) {
                            return this._return(resolve);
                        }
                    });
                }).once('error', e => reject(e));

            /* cipher file ? **/
            if (this.crypto_mode) cipher = await this._getCipher();


            /* busboy file events **/
            bfile.file
                .once('limit', this._file_limit(bfile, resolve))
                .once('error', this._file_err(bfile, reject))
                //.once('end', this._file_end(bfile));

            /* pipe **/
            if (this.detector_mode && this.crypto_mode) {
                debug_mode('DETECTION MODE && CRYPTO MODE');

                const fileTypeStream = await fileType.stream(bfile.file);

                if (!this._allowedExtensions(fileTypeStream)) {
                    return this
                        .typeNotAllowed(bfile, fileTypeStream)
                        ._return(resolve);
                } else {
                    if (encoding === 'base64')
                        fileTypeStream
                            .pipe(new Base64Decode())
                            .pipe(cipher.cipherStream)
                            .pipe(cipher.cipherStreamIV)
                            .pipe(bfile.writeable);
                    else
                        fileTypeStream
                            .pipe(cipher.cipherStream)
                            .pipe(cipher.cipherStreamIV)
                            .pipe(bfile.writeable);
                }
            } else if (!this.detector_mode && this.crypto_mode) {
                debug_mode('NO DETECTION MODE && CRYPTO MODE');

                if (encoding === 'base64')
                    bfile.file
                        .pipe(new Base64Decode())
                        .pipe(cipher.cipherStream)
                        .pipe(cipher.cipherStreamIV)
                        .pipe(bfile.writeable);
                else
                    bfile.file
                        .pipe(cipher.cipherStream)
                        .pipe(cipher.cipherStreamIV)
                        .pipe(bfile.writeable);

            } else if (this.detector_mode && !this.crypto_mode) {
                debug_mode('DETECTION MODE && NO CRYPTO MODE');

                const fileTypeStream = await fileType.stream(bfile.file);

                if (!this._allowedExtensions(fileTypeStream)) {
                        return this
                            .typeNotAllowed(bfile, fileTypeStream)
                            ._return(resolve);
                    } else {
                        if (encoding === 'base64')
                            fileTypeStream
                                .pipe(new Base64Decode())
                                .pipe(bfile.writeable);
                        else
                            fileTypeStream.pipe(bfile.writeable);
                    }


            } else if (!this.detector_mode && !this.crypto_mode) {
                debug_mode('NO DETECTION MODE && NO CRYPTO MODE');

                if (encoding === 'base64')
                    bfile.file
                        .pipe(new Base64Decode())
                        .pipe(bfile.writeable);
                else
                    bfile.file.pipe(bfile.writeable);
            }
        }
    }

    typeNotAllowed(bfile, fileTypeStream){
        bfile.error = `EXTENSION NOT ALLOWED ${bfile.ext}`;
        debug_mime(`ERROR MUST BE INCLUDED: EXTENSION NOT ALLOWED ${bfile.ext}`);
        bfile.file.resume();
        fileTypeStream.destroy();
        this.response.files.push(bfile.toJson());
        BusBoss._deleteFailed(bfile.fullPath());
        return this;
    }

    /**
     * busFile.file limit bytes event callback
     *
     * @param bfile
     * @param resolve
     * @return {Function}
     * @private
     */
    _file_limit(bfile, resolve) {
        return () => {
            debug_bus(`bytes limit ${this.opt.limits.fileSize} exceeded on File: ${bfile.filename}`);
            bfile.error = `BYTES LIMIT EXCEEDED, limit ${this.opt.limits.fileSize} bytes`;
            bfile.file.resume(); //fires finish
            BusBoss._deleteFailed(bfile.fullPath());
            if (this.busboy_finished)
                return this._return(resolve);
        }
    };

    /**
     * busFile.file error event callback
     *
     * @param bfile
     * @param reject
     * @return {function(*): *}
     * @private
     */
    _file_err(bfile, reject) {
        return (e) => {
            debug_bus(`File ON ERROR [ ${bfile.filename} ] ERROR ->  ${e}`);
            bfile.error = `BUSBOY ERROR ${e.message}`;
            return reject(bfile);
        }
    };


    /**
     * busFile.file finish event callback
     *
     * @param bfile
     * @return {Function}
     * @private
     */
    _file_end(bfile) {
        return () => {
            this.response.files.push(bfile.toJson());
            debug_bus(`File ON END [ ${bfile.filename} ] Finished`);

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
     * @return {boolean}
     * @private
     * @param fileTypeStream
     */
    _allowedExtensions(fileTypeStream) {
        debug_mime(fileTypeStream.fileType);
        if(!fileTypeStream)
            return false;
        if(!fileTypeStream.fileType)
            return false;
        if(!fileTypeStream.fileType.hasOwnProperty('ext'))
            return false;
        if(!fileTypeStream.fileType.hasOwnProperty('mime'))
            return false;

        if (this._checkExtension(fileTypeStream.fileType.ext)) {
            debug_mime("checkExtension allow ---> ", fileTypeStream.fileType.ext);
            return true;
        } else {
            debug_mime('Rejected file of type ', fileTypeStream.fileType.ext);
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
