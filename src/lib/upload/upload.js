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
const debug_bus_finish = require('debug')('cryptoBus:busboy:finish');
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

            const busFile = new BusFile()
            this._bus_on_file(opt).then(res => {
                console.log('weeeeeeeeeeeeeeee', res);
                this._closeReq(resolve);
            }).catch(e => console.log('ERRORRRRRRRRRRRRRRRRRRRRRRRRRRRRRR', e))


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
     * request finish event callback
     *
     * @return {Function}
     * @private
     */
    _req_finish() {
        return () => {
            debug('FINISH REQUEST');
            //Upload._removeListeners(this.busBoy);
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
                if (process.env.NODE_ENV === 'test') return;
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

};
