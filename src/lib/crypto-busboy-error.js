module.exports = class CryptoBusError extends Error {
    constructor(err) {
        super(err);
        this.name = 'UploadError';
        this.code = err.code;
        this.stack = err.stack;
    }
};
