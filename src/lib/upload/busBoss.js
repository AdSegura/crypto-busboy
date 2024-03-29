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
const CryptoBusError = require('../crypto-busboy-error');
const {finished, PassThrough} = require('stream');

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

            /* reject upload if timeout, without incoming data, reached **/
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
                .on('error', e => reject(e))
                .on('finish', this.finish_req());

            /* busboy on incoming file/files **/
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

            /* cipher file ? **/
            let cipher;
            if (this.crypto_mode) cipher = await this.getCipher();

            /* busboy file events **/
            bfile.file
                .once('limit', this.file_limit(bfile, resolve))
                .once('error', this.file_err(bfile, reject))
                .on('data', this.counter(bfile));

            /* finished for writeable stream  **/
            finished(bfile.writeable(), e => {
                if(e) return reject(new CryptoBusError(e));

                bfile.writeable_finished = true;
                this.finish_writeable(bfile)._return(resolve)
            });

            /* remote http stream ? listen for response event **/
            if(bfile.remote_http) this.listenForHttpResponse(bfile, resolve, reject);

            /* pipes **/
            if (this.detector_mode)
                return await this.pipelineDetection(bfile, cipher, resolve);

            return this.pipelineNoDetection(bfile, cipher)
        }
    }

    /**
     * listenForHttpResponse
     *
     * @param bfile
     * @param resolve
     * @param reject
     */
    listenForHttpResponse(bfile, resolve, reject){
        bfile
            .writeable()
            .once('response',
                this.remoteStreamHttpResponse(bfile, resolve, reject)
            );
    }

    /**
     * pipeline No Detection
     * @param bfile
     * @param cipher
     */
    pipelineNoDetection(bfile, cipher){
        debug_mode('NO DETECTION MODE');
        bfile
            .file
            .pipe(this.route(bfile.encoding === 'base64', new Base64Decode()))
            .pipe(this.route(this.crypto_mode, cipher ? cipher.cipherStream : undefined))
            .pipe(this.route(this.crypto_mode, cipher ? cipher.cipherStreamIV : undefined))
            .pipe(bfile.writeable());
    }

    /**
     * pipeline with detection
     * @param bfile
     * @param cipher
     * @param resolve
     * @return {Promise<undefined>}
     */
   async pipelineDetection(bfile, cipher, resolve){
        debug_mode('DETECTION MODE');

        let fileTypeStream = await fileType
            .stream(
                bfile.file
                    .pipe(this.route(bfile.encoding === 'base64', new Base64Decode()))
            );

        if (this.allowedExtensions(fileTypeStream))
            fileTypeStream
                .pipe(this.route(this.crypto_mode, cipher ? cipher.cipherStream : undefined ))
                .pipe(this.route(this.crypto_mode, cipher ? cipher.cipherStreamIV : undefined))
                .pipe(bfile.writeable());
        else
            return this.typeNotAllowed(bfile, fileTypeStream)._return(resolve);
    }
    /**
     * conditional stream
     *
     * @param bool
     * @param stream
     * @return {module:stream.internal.PassThrough|*}
     */
    route(bool, stream){
        if(bool) return stream;
        return new PassThrough();
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
        return () => {
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
    finish() {
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
    finish_writeable(bfile) {
        if(!bfile.remote_http){
            bfile.finished = true;
            this.response.files.push(bfile.toJson());
            bfile.remListeners();
            debug_bus_finish('WRITEABLE FINISH', bfile.toJson());
        } else if(bfile.remote_http && bfile.got_http_remote_res && bfile.writeable_finished) {
            bfile.finished = true;
            this.response.files.push(bfile.toJson());
            bfile.remListeners();
            debug_bus_finish('HTTP REMOTE WRITEABLE FINISH', bfile.toJson());

        }

        return this;
    }

    /**
     * finish cb req event
     *
     * @return {Function}
     */
    finish_req() {
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
            /*this.filesToDisk.forEach(failed => {
                //BusBoss.deleteFailed(failed.fullPath());
            });*/
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
        if (file.includes('stream://')) return;

        debug('deleteFailed -> DELETING FILE -> ', file);

        fs.unlink(file, (err) => {
            if (err) {
                //if (process.env.NODE_ENV === 'test') return;
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

    /**
     * remoteStreamHttpResponse from remote http endpoint
     *
     * @param bfile
     * @param resolve
     * @param reject
     * @return {Function} Resolve or Reject a remote stream
     */
    remoteStreamHttpResponse(bfile, resolve, reject) {
        return res => {
            bfile.got_http_remote_res = true;
            if (res.statusCode === 200)
                return this.finish_writeable(bfile)._return(resolve);

            return reject(
                new CryptoBusError(
                    `remote http Upload endpoint statusCode: ${res.statusCode}, statusMessage: ${res.statusMessage}`
                )
            );
        }
    }
};
