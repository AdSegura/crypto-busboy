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

            /* pipe request to busboy through detectorTimeout **/
            req
                .pipe(this.busBoy)
                .on('error', reject)
        })
    }
};
