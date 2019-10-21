const TypeDetectorStream = require('./typeDetectorStream');
const debug = require('debug')('cryptoBus:detector');

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
                debug('found type', type.ext);
                //this.detector.removeAllListeners();
                return resolve(type)
            });

            this.detector.sms.once('not_found', () => {
                debug('not_found');
                //this.detector.removeAllListeners();
				return resolve()
            });

            this.detector.once('finish', () => {
                debug('stream finish');
                //this.detector.removeAllListeners();
                return resolve();
            });

            this.detector.once('error', (e) => {
                debug('error ', e);
                //this.detector.removeAllListeners();
                reject(e);
            });
        })
    }

    remListeners(){
        //this.detector.sms.removeListener('mime')
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
