module.exports = class CryptoError extends Error {
    constructor(err) {

        super(err.message);

        this.name = 'CryptoUploadError';
        this.code = err.code;
        this.stack = err.stack;
        this.message = err.message;
    }
};
