const fs = require('fs');
const DetectorTimeout = require('../detector-timeout');
const FileExtensions = require('../file-extensions');
const {Base64Decode} = require('base64-stream');
const debug = require('debug')('cryptoBus:busFile');
const debug_mode = require('debug')('cryptoBus:mode');
const debug_bus = require('debug')('cryptoBus:busboy');
const debug_bus_finish = require('debug')('cryptoBus:busboy:finish');
const debug_mime = require('debug')('cryptoBus:mime');
const File = require('./file');
const fileType = require('file-type');

module.exports = class BusBoss {

    constructor(opt, crypto_mode, detector_mode, cipher) {
        this.opt = Object.assign({}, opt);
        this.response = {
            files: [],
            fields: [],
            errors: [],
            warnings: [],
        };
        this.filesToDisk = [];
        this.crypto_mode = crypto_mode;
        this.detector_mode = detector_mode;
        this.folder = this.getCryptoBusDestination(this.opt);
        this.error = null;
        this.detectorTimeout = new DetectorTimeout(opt);
        this.cipher = cipher;
        this.busboy_finished = false;
    }

    /**
     * start upload
     *
     * @param req
     * @param busBoy
     * @param folder
     * @return {Promise<unknown>}
     */
    start(req, busBoy, folder) {
        return new Promise((resolve, reject) => {
            debug_bus('Start Busboy Core');

            this.detectorTimeout.detect_timeout(this.detector_timeout(reject));

            /* busboy events **/
            busBoy
                .on('field', this.fields())
                .on('filesLimit', this.filesLimit())
                .on('error', this.busBoyError(resolve))
                .on('finish', this.finish());

            /* pipe request to busboy through detectorTimeout **/
            req
                .pipe(this.detectorTimeout)
                .pipe(busBoy)
                .on('error', reject)
                .on('finish', this.finish_req());

            busBoy.on('file', this.onFile(folder, resolve, reject));
        });
    }

    /**
     * busboy onFile event
     *
     * @param folder
     * @param resolve
     * @param reject
     * @return {Function}
     * @private
     */
    onFile(folder, resolve, reject) {
        return async (fieldname, file, filename, encoding, mimetype) => {
            debug_bus(`File [${fieldname}]: filename: ${filename}, encoding: ${encoding}, mimeType: ${mimetype}`);

            let cipher;

            /* on file new busFile **/
            const bfile = new File(
                fieldname,
                file,
                filename,
                encoding,
                mimetype,
                folder,
                this.crypto_mode,
                this.detector_mode
            );

            /* record file in array **/
            this.filesToDisk.push(bfile);

            /* fs writeableStream events **/
            bfile.writeable
                .once('finish', () => {
                   return this.finish_writeable(bfile)._return(resolve);
                }).once('error', e => reject(e));

            /* cipher file ? **/
            if (this.crypto_mode) cipher = await this.getCipher();

            /* busboy file events **/
            bfile.file
                .once('limit', this.file_limit(bfile, resolve))
                .once('error', this.file_err(bfile, reject))
                .on('data', this.counter(bfile));

            /* pipes **/
            if (this.detector_mode && this.crypto_mode) {
                debug_mode('DETECTION MODE && CRYPTO MODE');

                let fileTypeStream;

                if (encoding === 'base64')
                    fileTypeStream = await fileType.stream(bfile.file.pipe(new Base64Decode()));
                else
                    fileTypeStream = await fileType.stream(bfile.file);


                if (!this.allowedExtensions(fileTypeStream))
                    return this
                        .typeNotAllowed(bfile, fileTypeStream)
                        ._return(resolve);
                else
                    fileTypeStream
                        .pipe(cipher.cipherStream)
                        .pipe(cipher.cipherStreamIV)
                        .pipe(bfile.writeable);

            } else if (!this.detector_mode && this.crypto_mode) {
                debug_mode('NO DETECTION MODE && CRYPTO MODE');

                if (encoding === 'base64')
                    bfile.file
                        .pipe(new Base64Decode())
                        .pipe(cipher.cipherStream)
                        .pipe(cipher.cipherStreamIV)
                        .pipe(bfile.writeable);
                else
                    bfile.file
                        .pipe(cipher.cipherStream)
                        .pipe(cipher.cipherStreamIV)
                        .pipe(bfile.writeable);

            } else if (this.detector_mode && !this.crypto_mode) {
                debug_mode('DETECTION MODE && NO CRYPTO MODE');

                let fileTypeStream;

                if (encoding === 'base64')
                    fileTypeStream = await fileType.stream(bfile.file.pipe(new Base64Decode()));
                else
                    fileTypeStream = await fileType.stream(bfile.file);

                if (!this.allowedExtensions(fileTypeStream))
                    return this
                        .typeNotAllowed(bfile, fileTypeStream)
                        ._return(resolve);
                else
                    fileTypeStream.pipe(bfile.writeable);

            } else if (!this.detector_mode && !this.crypto_mode) {
                debug_mode('NO DETECTION MODE && NO CRYPTO MODE');

                if (encoding === 'base64')
                    bfile.file
                        .pipe(new Base64Decode())
                        .pipe(bfile.writeable);
                else
                    bfile.file.pipe(bfile.writeable);
            }
        }
    }

    /**
     * File is not allowed
     *
     * @param bfile
     * @param fileTypeStream
     * @return {BusBoss}
     */
    typeNotAllowed(bfile, fileTypeStream) {
        bfile.error = `EXTENSION NOT ALLOWED ${bfile.ext}`;

        debug_mime(`ERROR MUST BE INCLUDED: EXTENSION NOT ALLOWED ${bfile.ext}`);

        this.destroy_streams([bfile.file, fileTypeStream]);

        bfile.failed = true;
        bfile.finished = true;
        this.response.files.push(bfile.toJson());

        BusBoss.deleteFailed(bfile.fullPath());
        return this;
    }

    /**
     * Destroy streams
     *
     * @param arr
     */
    destroy_streams(arr) {
        arr.forEach(stream => stream.destroy())
    }

    /**
     * busFile.file limit bytes event callback
     *
     * @param bfile
     * @param resolve
     * @return {Function}
     * @private
     */
    file_limit(bfile, resolve) {
        return () => {
            debug_bus(`bytes limit ${this.opt.limits.fileSize} exceeded on File: ${bfile.filename}`);

            bfile.error = `BYTES LIMIT EXCEEDED, limit ${this.opt.limits.fileSize} bytes`;
            bfile.failed = true;
            bfile.finished = true;
            bfile.file.resume(); //fires finish
            BusBoss.deleteFailed(bfile.fullPath());

            if (this.busboy_finished) return this._return(resolve);
        }
    };

    /**
     * busFile.file error event callback
     *
     * @param bfile
     * @param reject
     * @return {function(*): *}
     * @private
     */
    file_err(bfile, reject) {
        return (e) => {
            debug_bus(`File ON ERROR [ ${bfile.filename} ] ERROR ->  ${e}`);
            bfile.error = `BUSBOY ERROR ${e.message}`;
            bfile.failed = true;
            bfile.finished = true;
            return reject(bfile);
        }
    };

    /**
     * field event callback
     *
     * @return {Function}
     * @private
     */
    fields() {
        return (fieldname, val) => {
            debug_bus('BusBoy ON FIELD, ', fieldname, val);
            if (fieldname === 'Content-Type') return;
            this.response.fields.push({[fieldname]: val});
        }
    };

    /**
     * files limit cb busboy event
     *
     * @return {Function}
     */
    filesLimit() {
        return() => {
            debug_bus('MAX FILES REACHED, LIMIT IS: ', this.opt.limits.files);
            this.response.warnings.push(`MAX FILES REACHED, LIMIT IS ${this.opt.limits.files} FILES`);
        }
    }

    /**
     * BusBoy Error event callback
     *
     * @return {Function}
     * @private
     */
    busBoyError(resolve) {
        return e => {
            debug_bus('busboy Error', e);
            this.response.errors.push(e.message);
            this.detectorTimeout.clearDetector();
            this.filesToDisk.forEach(failed => {
                BusBoss.deleteFailed(failed.fullPath());
            });
            return this._return(resolve);
        }
    };

    /**
     * finish cb busboy event
     *
     * @return {Function}
     */
    finish(){
        return () => {
            debug_bus('busboy finish parsing form!');
            this.busboy_finished = true;
        }
    }

    /**
     * finish cb writeable event
     *
     * @return {Function}
     */
    finish_writeable(bfile){
        debug_bus_finish('WRITEABLE FINISH', bfile.toJson());
        bfile.finished = true;
        this.response.files.push(bfile.toJson());
        bfile.remListeners();
        return this;
    }

    /**
     * finish cb req event
     *
     * @return {Function}
     */
    finish_req(){
        return () => {
            this.detectorTimeout.clearDetector();
            debug_bus_finish('FINISH REQUEST');
        }
    }

    /**
     * return Promise with errors, warnings, files uploaded
     *
     * @private
     */
    _return(resolve) {
        if (!this.filesToDisk.some(file => file.finished === false)) {
            debug_bus_finish('BusBoss finish ALL files finished with response -> ', this.response);
            return resolve(this.response);
        }
    }

    /**
     * detector timeOut callback
     *
     * @param reject
     * @return {function(*=): *}
     * @private
     */
    detector_timeout(reject) {
        return (err) => {
            if (!err) return;
            debug_mime('TIMEOUT DELETE ALL FAILED', this.filesToDisk);
            this.filesToDisk.forEach(failed => {
                BusBoss.deleteFailed(failed.fullPath());
            });
            return reject(err);
        }
    };

    /**
     * Allowed Extensions Check
     *
     * @return {boolean}
     * @private
     * @param fileTypeStream
     */
    allowedExtensions(fileTypeStream) {
        debug_mime(fileTypeStream.fileType);
        if (!fileTypeStream)
            return false;
        if (!fileTypeStream.fileType)
            return false;
        if (!fileTypeStream.fileType.hasOwnProperty('ext'))
            return false;
        if (!fileTypeStream.fileType.hasOwnProperty('mime'))
            return false;

        if (this.checkExtension(fileTypeStream.fileType.ext)) {
            debug_mime("checkExtension allow ---> ", fileTypeStream.fileType.ext);
            return true;
        } else {
            debug_mime('Rejected file of type ', fileTypeStream.fileType.ext);
            return false;
        }
    }

    /**
     * Check if extension is allowed
     *
     * @param extension
     * @return {boolean}
     * @private
     */
    checkExtension(extension) {
        debug_mime('checkExtension extension --> ', extension);
        debug_mime('checkExtension extensions --> ', this.opt.limits.allowed);
        return (this.opt.limits.allowed.indexOf(FileExtensions.normalizeExtensions(extension)) >= 0);
    }

    /**
     * get cipher streams
     *
     * @return {Promise<{cipherStreamIV, cipherStream}>}
     * @private
     */
    async getCipher() {
        return await this.cipher.getCipherStreams();
    }

    /**
     * get where the file is going to be stored
     *
     * @param opt
     * @return {*}
     * @private
     */
    getCryptoBusDestination(opt) {
        let dest;
        if (opt && typeof opt === 'object') {
            if (opt.dest)
                dest = opt.dest
        } else {
            dest = this.opt.dest;
        }
        return dest;
    }

    /**
     * Delete failed Files
     *
     * @param {*} file
     * @private
     */
    static deleteFailed(file) {
        debug('deleteFailed -> DELETING FILE -> ', file);
        fs.unlink(file, (err) => {
            if (err) {
                if (process.env.NODE_ENV === 'test') return;
                console.error(err);
            }
        });
    }

    /**
     * Counts bytes
     *
     * @param bfile
     * @return {Function}
     */
    counter(bfile) {
        return data => {
            bfile.size += data.length;
        }
    }
};
