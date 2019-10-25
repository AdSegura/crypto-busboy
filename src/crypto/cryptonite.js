const AppendInitVect = require('./initVector');
const crypto = require('crypto');
const CryptoError = require('./cryptoError');
const fs = require('fs');
const debug = require('debug')('cryptoBus:crypto');

module.exports = class Cryptonite {

    constructor(opt) {
        this.options = opt || {};

        if(! this.options.key)
            throw new CryptoError('No key defined');

        this.key = this.getCipherKey();

        this.alg = this.options.alg || 'aes-256-cbc';
        //this.alg = 'aes256';
        debug('ALGORITHM', this.alg)
    }

    /**
     * create cipher iv
     *
     * @param iv
     * @return {Cipher}
     */
    createCipheriv(iv){
        return crypto.createCipheriv(this.alg, this.key, iv)
    };

    /**
     * key to buffer
     *
     * @param alg
     * @return {Buffer}
     */
    getCipherKey(alg) {
        alg = alg || 'sha256';
        return crypto.createHash(alg).update(this.options.key).digest();
    }

    /**
     * appendIV
     */
    static async appendIV(iv){
        iv = iv || await Cryptonite.generateIV();
        return new AppendInitVect(iv);
    };

    /**
     * Generate IV
     *
     * @return {Promise<any>}
     */
   static async generateIV(bytes){
        return new Promise((resolve, reject) => {
            bytes = bytes || 16;
            crypto.randomBytes(bytes, (e, buffer) => {
                if(e) return reject(e);
                resolve(buffer)
            });
        })
    }

    /**
     * Write Cipher File stream
     *
     * @param file
     * @param dest
     * @param reject
     * @return {Promise<void>}
     */
  async cipherFileStream(file, dest, reject){
        const iv = await Cryptonite.generateIV();
        const streamIV = await Cryptonite.appendIV(iv);

        file
            .pipe(this.createCipheriv(iv))
            .pipe(streamIV)
            .pipe(fs.createWriteStream(dest))
            .on('error', (e) => {
                return reject(e)
            })
    }

    async getCipherStreams() {
        const iv = await Cryptonite.generateIV();
        return {
            cipherStream: this.createCipheriv(iv),
            cipherStreamIV: await Cryptonite.appendIV(iv)
        };
    }

    /**
     * decipher file stream
     *
     * @param file
     * @return {Promise<*>}
     */
  decryptFileStream(file){
        return new Promise((resolve, reject) => {

            let initVect;

            const readInitVect = fs.createReadStream(file, {
                end: 15
            });

            readInitVect.on('error', (e) => {
                return reject(e)
            });


            readInitVect.on('data', (chunk) => {
                initVect = chunk;
            });

            // Once we’ve got the initialization vector, we can decrypt the file.
            readInitVect.on('close', () => {
                const readStream = fs.createReadStream(file, {
                    start: 16
                });

                try {
                    const decipher = crypto.createDecipheriv(this.alg, this.key, initVect);
                    return resolve(readStream.pipe(decipher));
                } catch (e) {
                    return reject(e);
                }

            });
        })
    }
};
