const Busboy = require('busboy');
const DetectorTimeout = require('../detector-timeout');
const BusFile = require('./busFile');
const fs = require('fs');
const Detector = require('../fileTypeDetector');
const FileExtensions = require('../file-extensions');
const {Base64Decode} = require('base64-stream');

const debug = require('debug')('cryptoBus:upload');
const debug_mode = require('debug')('cryptoBus:mode');
const debug_bus = require('debug')('cryptoBus:busboy');
const debug_mime = require('debug')('cryptoBus:mime');

module.exports = class Upload {
    constructor(opt, crypto_mode, detection_mode, cipher) {
        this.opt = Object.assign({}, opt);
        this.files = [];
        this.errors = [];
        this.warnings = [];
        this.fields = [];
        this.filesToDisk = [];
        this.req_finished = false;
        this.busboy_finished = false;
        this.detectorTimeout = new DetectorTimeout(opt);
        this.busBoy = null;

        this._crypto_mode = crypto_mode;
        this._detection_mode = detection_mode;
        this.cipher = cipher;
        debug('new Upload instance created')
    }

    /**
     * start upload
     *
     * @param req
     * @param opt
     * @return {Promise<unknown>}
     */
    start(req, opt) {
        return new Promise((resolve, reject) => {

            this.busBoy = this._getBusBoy(req, opt);

            debug_bus('Start Busboy Core');
            this.detectorTimeout.detect_timeout(this._detector_timeout(reject));

            /* start busboy file listener **/
            this._bus_on_file(opt, resolve, reject);

            /* busboy events **/
            this.busBoy
                .on('field', this._field_cb())
                .on('filesLimit', this._filesLimit_cb())
                .on('error', this._bb_error_cb(resolve, req))
                .on('finish', this._finish_bb_cb());

            /* pipe request to busboy through detectorTimeout **/
            req
                .pipe(this.detectorTimeout)
                .pipe(this.busBoy)
                .on('error', reject)
                .on('finish', this._req_finish())
        })
    }

    /**
     * busboy.on file stream
     *
     * @param opt
     * @param resolve
     * @param reject
     * @private
     */
    _bus_on_file(opt, resolve, reject) {
        debug_bus('Busboy listener on FILE');
        this.busBoy.on('file', async (fieldname, file, filename, encoding, mimetype) => {
            debug_bus(`File [${fieldname}]: filename: ${filename}, encoding: ${encoding}, mimeType: ${mimetype}`);

            let cipher, detector;

            /* on file new busFile **/
            const busFile = new BusFile(
                file,
                filename,
                fieldname,
                this._getCryptoBusDestination(opt),
                this._crypto_mode
            );

            /* store in temp array file path **/
            this.filesToDisk.push(busFile.fullPath());

            /* fs writeableStream events **/
            busFile.writeable
                .on('finish', this._writeable_finish_cb(busFile, resolve))
                .on('error', e => Promise.reject(e));

            /* cipher file ? **/
            if (this._crypto_mode) cipher = await this._getCipher();

            /* detector **/
            if (this._detection_mode) {
                detector = this._getDetector();
                detector
                    .detect()
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

                if(encoding === 'base64')
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

                if(encoding === 'base64')
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

                if(encoding === 'base64')
                    busFile.file
                        .pipe(new Base64Decode())
                        .pipe(detector.stream())
                        .pipe(busFile.writeable);
                else
                    busFile.file
                        .pipe(detector.stream())
                        .pipe(busFile.writeable);

            } else if (!this._detection_mode && !this._crypto_mode) {
                debug_mode('NO DETECTION MODE && NO CRYPTO MODE');

                if(encoding === 'base64')
                    busFile.file
                        .pipe(new Base64Decode())
                        .pipe(busFile.writeable);
                else
                    busFile.file
                        .pipe(busFile.writeable);
            }
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

    /**
     * get cipher streams
     *
     * @return {Promise<{cipherStreamIV, cipherStream}>}
     * @private
     */
    async _getCipher() {
        return await this.cipher.getCipherStreams();
    }

    /**
     * Get busboy
     *
     * @param req
     * @param opt
     * @return {Busboy}
     * @private
     */
    _getBusBoy(req, opt) {
        return new Busboy({
            headers: req.headers,
            limits: this._getCryptoBusLimits(opt)
        });
    }

    /**
     * get Crypto Bus Limits
     *
     * @param opt
     * @return {*}
     * @private
     */
    _getCryptoBusLimits(opt) {
        let limits;
        if (opt && typeof opt === 'object') {
            if (opt.limits)
                limits = opt.limits
        } else {
            limits = this.opt.limits;
        }
        return limits;
    }

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
     * request finish event callback
     *
     * @return {Function}
     * @private
     */
    _req_finish() {
        return () => {
            debug('FINISH');
            Upload._removeListeners(this.busBoy);
            this.detectorTimeout.clearDetector();
            this.req_finished = true;
        }
    };

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
            this.fields.push({[fieldname]: val});
        }
    };

    /**
     * limits event callback
     *
     * @return {Function}
     * @private
     */
    _filesLimit_cb() {
        return () => {
            debug_bus('MAX FILES REACHED, LIMIT IS: ', this.opt.limits.files);
            this.warnings.push(`MAX FILES REACHED, LIMIT IS ${this.opt.limits.files} FILES`);
        }
    };

    /**
     * BusBoy finish event callback
     *
     * @param f
     * @return {Function}
     * @private
     */
    _finish_bb_cb(f) {
        return () => {
            debug_bus('busboy finish parsing form!');
            this.busboy_finished = true;
        }
    };

    /**
     * BusBoy Error event callback
     *
     * @return {Function}
     * @private
     */
    _bb_error_cb(resolve, req) {
        return (e) => {
            debug_bus('busboy Error', e);
            this.errors.push(e.message);

            this.detectorTimeout.clearDetector();
            Upload._removeListeners(this.busBoy);
            this.filesToDisk.forEach(failed => {
                Upload._deleteFailed(failed);
            });
            return this._closeReq(resolve);
            //close all stream chained pipes to busboy file
        }
    };

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
            debug('TIMEOUT DELETE ALL FAILED', this.filesToDisk);
            this.filesToDisk.forEach(failed => {
                Upload._deleteFailed(failed);
            });
            return reject(err);
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
            if (this.busboy_finished) {
                Upload._removeListeners(busFile.writeable);
                Upload._removeListeners(busFile.file);
                process.nextTick(() => {
                    return this._closeReq(resolve);
                })
            }
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
            if (!type || !this._allowedExtensions(type.ext)) {
                busFile.error = `EXTENSION NOT ALLOWED ${busFile.ext}`;
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
            Upload._deleteFailed(busFile.fullPath());
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
     * Remove listeners for a given ee
     *
     * @param event
     * @private
     */
    static _removeListeners(event) {
        event.eventNames().forEach(listener => {
            event.removeAllListeners(listener);
        });
    }

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
                if(process.env.NODE_ENV === 'test') return;
                console.error(err);
            }
        });
    }

    /**
     * return Promise with errors, warnings, files uploaded
     *
     * @private
     */
    _closeReq(resolve) {
        debug('closereq Warnings -> ', JSON.stringify(this.warnings));
        debug('closereq Errors -> ', JSON.stringify(this.errors));
        debug('closereq Fields -> ', JSON.stringify(this.fields));
        debug('closereq Files -> ', JSON.stringify(this.files));

        const uploads = this.files.filter(f => f.error === null);
        const wrong = this.files.filter(f => f.error !== null);

        debug('WRONG', [...this.errors, ...wrong]);

        return resolve({
            warnings: this.warnings,
            errors: [...this.errors, ...wrong],
            files: uploads,
            fields: this.fields
        })
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
};
