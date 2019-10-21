const Busboy = require('busboy');
const DetectorTimeout = require('../detector-timeout');
const BusFile = require('./busFile');
const fs = require('fs');
const Detector = require('../fileTypeDetector');
const FileExtensions = require('../file-extensions');

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
    }

    start(req, opt) {
        return new Promise((resolve, reject) => {
            this.busBoy = this._getBusBoy(req, opt);
            this.detectorTimeout.detect_timeout(this._detector_timeout(reject));
            this._bus_on_file(opt, resolve, reject);

            this.busBoy
                .on('field', this._field_cb())
                .on('filesLimit', this._filesLimit_cb())
                .on('error', this._bb_error_cb())
                .on('finish', this._finish_bb_cb());

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
        this.busBoy.on('file', async (fieldname, file, filename, encoding, mimetype) => {
            debug_bus(`File [${fieldname}]: filename: ${filename},encoding: ${encoding}, mimeType: ${mimetype}`);

            let cipher, detector;

            const busFile = new BusFile(
                file,
                filename,
                fieldname,
                this._getCryptoBusDestination(opt),
                this._crypto_mode
            );

            this.filesToDisk.push(busFile.fullPath());

            busFile.writeable
                .on('finish', this._finish_cb(busFile, resolve))
                .on('error', e => Promise.reject(e));

            if (this._crypto_mode) cipher = await this._getCipher();

            if (this._detection_mode) {
                detector = this._getDetector();
                detector
                    .detect()
                    .then(this._detector_type(busFile, resolve))
                    .catch(this._detector_type_err);
            }

            busFile.file
                .on('limit', this._file_limit(busFile, resolve))
                .on('error', this._file_err(busFile, reject))
                .on('end', this._file_end(busFile));

            if (this._detection_mode && this._crypto_mode) {
                debug_mode('DETECTION MODE && CRYPTO MODE');
                busFile.file.pipe(detector.stream()).pipe(cipher.cipherStream).pipe(cipher.cipherStreamIV).pipe(busFile.writeable);
            } else if (!this._detection_mode && this._crypto_mode) {
                debug_mode('NO DETECTION MODE && CRYPTO MODE');
                busFile.file.pipe(cipher.cipherStream).pipe(cipher.cipherStreamIV).pipe(busFile.writeable);
            } else if (this._detection_mode && !this._crypto_mode) {
                debug_mode('DETECTION MODE && NO CRYPTO MODE');
                busFile.file.pipe(detector.stream()).pipe(busFile.writeable);
            } else if (!this._detection_mode && !this._crypto_mode) {
                debug_mode('NO DETECTION MODE && NO CRYPTO MODE');
                busFile.file.pipe(busFile.writeable);
            }
        });

    }

    /**
     * Get new Detector
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

    _req_finish() {
        return () => {
            debug('FINISH');
            Upload._removeListeners(this.busBoy);
            this.detectorTimeout.clearDetector();
            this.req_finished = true;
        }
    };

    _field_cb() {
        return (fieldname, val) => {
            debug_bus('BusBoy ON FIELD, ', fieldname, val);
            if (fieldname === 'Content-Type') return;
            this.fields.push({[fieldname]: val});
        }
    };

    _filesLimit_cb() {
        return () => {
            debug_bus('MAX FILES REACHED, LIMIT IS: ', this.opt.limits.files);
            this.warnings.push(`MAX FILES REACHED, LIMIT IS ${this.opt.limits.files} FILES`);
        }
    };

    _finish_bb_cb(f) {
        return () => {
            debug_bus('busboy finish parsing form!');
            this.busboy_finished = true;
        }
    };

    _bb_error_cb() {
        return (e) => {
            debug_bus('busboy Error', e);
            //close all stream chained pipes to busboy file
        }
    };

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

    _finish_cb(busFile, resolve) {
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

    _detector_type_err(e) {
        return Promise.reject(e)
    };

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

    _file_err(busFile, reject) {
        return (e) => {
            debug_bus(`File ON ERROR [ ${busFile.filename} ] ERROR ->  ${e}`);
            busFile.error = `BUSBOY ERROR ${e.message}`;
            return reject(busFile)
        }
    };

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
     */
    static _deleteFailed(file) {
        debug('deleteFailed -> DELETING FILE -> ', file);
        fs.unlink(file, (err) => {
            if (err) {
                console.error(err);
            }
        });
    }

    /**
     * return Promise with errors, warnings, files uploaded
     *
     */
    _closeReq(resolve) {
        debug('closereq Warnings -> ', JSON.stringify(this.warnings));
        debug('closereq Errors -> ', JSON.stringify(this.errors));
        debug('closereq Fields -> ', JSON.stringify(this.fields));
        debug('closereq Files -> ', JSON.stringify(this.files));

        const uploads = this.files.filter(f => f.error === null);
        const wrong = this.files.filter(f => f.error !== null);

        return resolve({
            warnings: this.warnings,
            errors: wrong,
            files: uploads,
            fields: this.fields
        })
    }

    /**
     * Allowed Extensions Check
     *
     * @param {*} ext ext property
     *
     * return BOLEAN
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
     * @param {*} extension
     */
    _checkExtension(extension) {
        debug_mime('checkExtension extension --> ', extension);
        debug_mime('checkExtension extensions --> ', this.opt.limits.allowed);
        return (this.opt.limits.allowed.indexOf(FileExtensions.normalizeExtensions(extension)) >= 0);
    }
};
