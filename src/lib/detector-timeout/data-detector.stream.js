const {Transform} = require('stream');
const debug = require('debug')('cryptoBus:data_detector');
setImmediate =  setImmediate || function (fn) { setTimeout(fn, 0) };
const TransSMS = require('../ee/transSMS');

module.exports = class timeOutTransform extends Transform {
    constructor(opt) {
        super(opt);
        this.opt = Object.assign({}, opt);
        this.opt.timeOut = this.opt.timeOut || 5000;
        this.timeout = null;
        this.sms = new TransSMS;
        this.sms_emitted = false;
        this.cb = null;
    }

    _transform(data, encoding, callback) {
        this.timer();
        callback(null, data)
    }

    timer(){
        if(this.timeout){
            clearTimeout(this.timeout)
        }

        this.timeout =  setTimeout(() => {
            debug('alert timeOut....');
            if(! this.sms_emitted) {
                debug('emit detector_timeout on request');
                this.sms.emit('detector_timeout', new Error('REQUEST TIMEOUT'));
                this.sms_emitted = true;
            }
        }, this.opt.timeOut)
    }

    detect_timeout(cb){
        this.cb = cb;
        this.sms.once('detector_timeout', (e) => {
            this.cb(e);
        })
    }

    clearDetector(){
        this.cb(null);
        clearTimeout(this.timeout)
    }
};
