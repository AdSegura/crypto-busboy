const Busboy = require('busboy');
const BusBoss = require('./busBoss');
const debug = require('debug')('cryptoBus:upload');

module.exports = class Upload {
    constructor(opt, crypto_mode, detection_mode, cipher) {
        this.opt = Object.assign({}, opt);
        this.files = [];
        this.errors = [];
        this.warnings = [];
        this.fields = [];
        this.busBoy = null;
        this._crypto_mode = crypto_mode;
        this._detection_mode = detection_mode;
        this.cipher = cipher;
    }

    /**
     * start upload
     *
     * @param req
     * @param opt
     * @return {Promise<array>}
     */
     start(req, opt) {
        return new Promise((resolve, reject) => {

            this.busBoy = this._getBusBoy(req, opt);

            const busBoss = new BusBoss(
                this.opt,
                this._crypto_mode,
                this._detection_mode,
                this.cipher
            );

            busBoss
                .start(req, this.busBoy, this.opt.dest)
                .then(res => resolve(this._closeReq(res)))
                .catch(e => reject(e))
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
     * return Promise with errors, warnings, files uploaded
     *
     * @private
     */
    _closeReq(response) {
        debug('upload close_req -> ', response);

        const uploads = response.files.filter(f => f.error === null);
        const wrong = response.files.filter(f => f.error !== null);

        return {
            warnings: response.warnings,
            errors: [...response.errors, ...wrong],
            files: uploads,
            fields: response.fields
        }
    }
};
