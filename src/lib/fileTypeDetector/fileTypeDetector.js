const TypeDetectorStream = require('./typeDetectorStream');
const debug = require('debug')('cryptoBus:detector');
const Helper = require('../lib/helper');

module.exports = class FileTypeDetector {

    constructor(opt){
        this.opt = Object.assign({}, opt);
        this.detector  = new TypeDetectorStream(this.opt);
    }

    /**
     * listeners, will try to detect mime type
     *
     * @return {Promise}
     */
    detect() {
        return new Promise((resolve, reject) => {

            this.detector.sms.once('mime', (type) => {
                debug('found type', type);
                Helper.remlisteners(this.detector.sms);
                return resolve(type)
            });

            this.detector.sms.once('not_found', () => {
                debug('not_found');
                Helper.remlisteners(this.detector.sms);
                return resolve()
            });

            this.detector.once('end', () => {
                debug('on END detector');
                Helper.remlisteners(this.detector);
                return resolve();
            });

            this.detector.once('error', (e) => {
                debug('error ', e);
                Helper.remlisteners(this.detector);
                reject(e);
            });

        })
    }

    /**
     * detector stream transform
     *
     * @return {StreamTypeTransform|*}
     */
    stream() {
        return this.detector;
    }

};
