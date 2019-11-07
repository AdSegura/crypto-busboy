const {Transform} = require('stream');
const fileType = require('file-type');
const TransSMS = require('../ee/transSMS');
const debug = require('debug')('cryptoBus:detector_stream');
setImmediate =  setImmediate || function (fn) { setTimeout(fn, 0) };

module.exports = class StreamTypeTransform extends Transform {

	constructor(opt) {
		super(opt);
		this.opt = Object.assign({}, opt);
		this.rounds = 2;
		this.sms = new TransSMS;
		this.sms_emitted = false;
		this.found = false;
		this.buffer = new Buffer.alloc(fileType.minimumBytes);
	}

	/**
	 * transform
	 *
	 * @param data
	 * @param encoding
	 * @param callback
	 * @private
	 */
	_transform(data, encoding, callback) {

		if (this.rounds === 0 && this.found === false) {
			if(! this.sms_emitted) {
				debug('emit not_found');
				this.sms.emit('not_found');
				this.sms_emitted = true;
			}
			return callback(null, data);
		}

		if (this.rounds === 0 || this.found)
			return callback(null, data);

		this.rounds -= 1;

		return this._detector(data, callback);
	}

	/**
	 * detect mime type
	 * @param data
	 * @param cb
	 * @private
	 */
	_detector(data, cb){
		try {
			const type = fileType(this.buffer.fill(data));
			debug('mime:', type, 'rounds:', this.rounds);
			if (type || this.rounds <= 0) this.sms.emit('mime', type);
			cb(null, data);
		} catch (e) {
			cb(null, data)
		}
	}

};
