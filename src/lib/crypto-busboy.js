const fs = require('fs');
const path = require('path');
const debug = require('debug')('cryptoBus:upload');
const MimeStream = require("mime-stream");
const makeFolder = require('../fs/index');
const CryptoBusError = require('./crypto-busboy-error');
const FileExtensions = require('./file-extensions');
const Upload = require('./upload');
const Cryptonite = require('../crypto/cryptonite');
const os = require('os');
const Helper = require('./lib/helper');
const cloneDeep = require('lodash/cloneDeep');

module.exports = class CryptoBusBoy {

    constructor(opt, upload) {
        this.options = cloneDeep(opt) || {};
        this._crypto_mode = false;
        this._detection_mode = false;
        this.cipher = null;
        this.options.dest = this.options.dest || os.tmpdir();

        this._checkDestinationFolder();
        this.options.limits = this.options.limits || {};

        if (this.options.limits && this.options.limits.hasOwnProperty('allowed')){
            this.options.limits.allowed = FileExtensions
                .normalizeExtensions(this.options.limits.allowed);
            this._detection_mode = true;
        }

        if(this.options.key) {
            const cryptoOpt = {key: this.options.key};
            if(this.options.alg) cryptoOpt.alg = this.options.alg;

            this.cipher = new Cryptonite(cryptoOpt);
            this._crypto_mode = true;
        }

        this.Upload = upload || Upload;
    }

    /**
     * Check if Dir is writable.
     */
    _checkDestinationFolder(folder) {
        folder = folder || this.options.dest;

        if(Helper.is_writeStream(folder)) return;

        try {
            return fs.accessSync(folder, fs.constants.W_OK)
        }catch (e) {
            throw new CryptoBusError(e);
        }
    }

    /**
     * UPLOAD
     * @param {*} req
     * @param opt options [optional]
     */
    async upload(req, opt) {
        debug('upload start');
        let options;

        if (opt) {
            if (typeof opt != 'object')
                throw new CryptoBusError('upload options must be object');
            if (!opt.dest)
                throw new CryptoBusError('upload options must have dest option');

            options = cloneDeep(opt)
        }

        try {
            if (options && !Helper.is_writeStream(options.dest))
                await makeFolder(options.dest);

            return await this._processRequestFiles(req, options);
        } catch (e) {
            return await Promise.reject(new CryptoBusError(e));
        }
    }

    /**
     * Download a file
     *
     * @param req
     * @param res
     * @param next
     * @param file
     */
    download(req, res, next, file) {
        file = file || req.params.file;

        if (file.includes('-ciphered'))
            return this.getCipherFile(file, res, next);

        return this.getUnCipherFile(file, res, next);
    }

    /**
     * Upload
     * opt {
     *    key: 'fooBarBaz', //you can omit this, and no enc will happen
     *    dest: folder,
     *    limits: {
     *          fileSize: 1024 * 1024,
     *          files: 2,
     *          allowed: ['jpeg', 'png'] //https://github.com/sindresorhus/file-type/issues/162
     *  }}
     *
     * @param {*} req
     * @param opt [optional] {dest}
     */
    _processRequestFiles(req, opt) {
        // One important caveat is that if the Readable stream emits an error during processing,
        // the Writable destination is not closed automatically.
        // If an error occurs, it will be necessary to manually close each stream in order to prevent memory leaks.
        debug('Start processing Request Files');

        const errors = CryptoBusBoy._checkHeaders(req);

        if(errors !== true)
            return Promise.resolve({errors, warnings: [], files: []});

        const up = new this.Upload(
            this.options,
            this._crypto_mode,
            this._detection_mode,
            this.cipher
        );

        return up.start(req, opt);
    }

    /**
     * Check request headers
     *
     * @param req
     * @return {Array|boolean}
     */
    static _checkHeaders(req) {
        if (!req.headers) return ['no headers found in request'];

        if (!req.headers['content-type']) return ['Missing Content-Type'];

        if (!req.headers['content-type'].includes('multipart/form-data; boundary='))
            return ['no multipart/form-data; header found'];

        return true;
    }

    /**
     * Download cipher file
     *
     * @param file
     * @param res
     * @param next
     */
    getCipherFile(file, res, next) {
        const destination = path.join(this.options.dest, file);
        const toMimeStream = new MimeStream();
        this.cipher.decryptFileStream(destination)
            .then(decrypted => {
                toMimeStream.on("type", (type) => { // { ext: "png", mime: "image/png" }
                    if (type) res.writeHead(200, {
                        'Content-Type': type.mime
                    });
                });

                decrypted.on('error', (e) => {
                    return next(e)
                }).pipe(toMimeStream).pipe(res);

            }).catch((e) => {
                next(e);
        });
    }

    /**
     * Download cipher file
     *
     * @param file
     * @param res
     * @param next
     */
    getUnCipherFile(file, res, next) {
        const toMimeStream = new MimeStream();
        const file_path = path.join(this.options.dest, file);

        const readStream = fs.createReadStream(file_path)
            .on('error', (e) => {
                console.error(e);
                return res.end('404')
            });

        toMimeStream.on("type", (type) => {
            if (type) res.writeHead(200, {
                'Content-Type': type.mime
            });
        });

        readStream
            .pipe(toMimeStream)
            .pipe(res)
            .on('error', (e) => {
                console.error(e);
                next(e);
            })
    }
};
