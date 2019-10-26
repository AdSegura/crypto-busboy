const debug_bus = require('debug')('cryptoBus:busboy');
const Upload = require('../../src/lib/upload');

module.exports = class MockUpload extends Upload {
    constructor(opt, crypto_mode, detection_mode, cipher){
        super(opt, crypto_mode, detection_mode, cipher);
    }

    start(req, opt) {
        return new Promise((resolve, reject) => {

            this.busBoy = this._getBusBoy(req, opt);

            /**
             * MOCK TO FORCE BB ERROR RESPONSE
             */
            setTimeout(() => {
                this.busBoy.emit('error', new Error('Mock Error on busboy'))
            },0);

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
};
