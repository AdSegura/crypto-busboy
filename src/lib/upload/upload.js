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

            /* start busboy file listener **/

            const busFile = new BusFile(this.opt, this._crypto_mode, this._detection_mode, this.cipher);

            busFile.start(req, this.busBoy, this.opt.dest)
                .then(res => {
                //console.log('response', res);
                resolve(this._closeReq(res));
            }).catch(e => {
                debug('start error', e);
                reject(e)
            })

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
    _closeReq(response) {
        debug('closereq Warnings -> ', response);

        const uploads = response.files.filter(f => f.error === null);
        const wrong = response.files.filter(f => f.error !== null);

        debug('WRONG', [...response.errors, ...wrong]);

        return {
            warnings: response.warnings,
            errors: [...response.errors, ...wrong],
            files: uploads,
            fields: response.fields
        }
    }

};
