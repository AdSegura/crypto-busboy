const fs = require('fs');
const path = require('path');
const debug = require('debug')('cryptoBus:upload');
const MimeStream = require("mime-stream");
const makeFolder = require('../fs/index');
const CryptoBusError = require('./crypto-busboy-error');
const Base = require('./base');

module.exports = class CryptoBusBoy extends Base {

    constructor(opt, upload) {
        super(opt, upload);
    }

    /**
     * UPLOAD
     * @param {*} req
     * @param opt options [optional]
     */
    async upload(req, opt) {
        debug('upload start');
        if (opt) {
            if (typeof opt != 'object')
                throw new CryptoBusError('upload options must be object');
            if (!opt.dest)
                throw new Error('upload options must have dest option');
        }

        try {
            if (opt) await makeFolder(opt.dest);
            return await this.processRequestFiles(req, opt);
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
     * @param opt [optional] {dest, perms}
     */
    processRequestFiles(req, opt) {
        // One important caveat is that if the Readable stream emits an error during processing,
        // the Writable destination is not closed automatically.
        // If an error occurs, it will be necessary to manually close each stream in order to prevent memory leaks.
        debug('processRequestFiles');

        const errors = CryptoBusBoy.checkHeaders(req);
        if(errors !== true)
            return Promise.resolve({errors, warnings: [], files: []});

        const up = new this.Upload(this.options, this._crypto_mode, this._detection_mode, this.cipher);
        return up.start(req, opt);
    }

    /**
     * Check request headers
     *
     * @param req
     * @return {Array|boolean}
     */
    static checkHeaders(req) {
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
