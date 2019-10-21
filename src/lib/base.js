const Cryptonite = require('../crypto/cryptonite');
const CryptoBusError = require('./crypto-busboy-error');
const os = require('os');
const fs = require('fs');
const FileExtensions = require('./file-extensions');


module.exports = class Base {
    constructor(opt) {
        this.options = opt || {};
        this._crypto_mode = false;
        this._detection_mode = false;
        this.cipher = null;

        this.options.dest = this.options.dest || os.tmpdir();
        this.checkDestinationFolder();
        this.options.limits = this.options.limits || {};

        if (this.options.limits && this.options.limits.hasOwnProperty('allowed')){
            this.options.limits.allowed = FileExtensions.normalizeExtensions(opt.limits.allowed);
            this._detection_mode = true;
        }

        if(this.options.key) {
            const cryptoOpt = {key: this.options.key};
            if(this.options.alg) cryptoOpt.alg = this.options.alg;

            this.cipher = new Cryptonite(cryptoOpt);
            this._crypto_mode = true;
        }
    }


    /**
     * Check if Dir is writable.
     */
    checkDestinationFolder(folder) {
        folder = folder || this.options.dest;
        try {
            return fs.accessSync(folder, fs.constants.W_OK)
        }catch (e) {
            throw new CryptoBusError(e);
        }
    }

};
