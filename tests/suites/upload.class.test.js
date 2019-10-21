const {it} = require("mocha");
const {expect} = require("chai");
const Helper = require('../lib/helper');
const os = require('os');

module.exports = function suite(CryptoBusBoy) {

    it('should instantiate CryptoBusBoy module withOut options, options dest folder should be os.tmpdir', async () => {
        const upload = new CryptoBusBoy();
        expect(upload.options.dest).eql(os.tmpdir());
        expect((Object.keys(upload.options.limits)).length).eql(0)
    });

    it(`should instantiate CryptoBusBoy module with options, options dest folder should be defined`,
        async () => {
            const upload = new CryptoBusBoy({dest: Helper.getUploadServerFolder()});
            expect(upload.options.dest).eql(Helper.getUploadServerFolder());
            expect((Object.keys(upload.options.limits)).length).eql(0);
    });

    it('should instantiate CryptoBusBoy module with limits options, options should have limits', async () => {
        const upload = new CryptoBusBoy({
            limits: {
                fileSize: 1024 * 1024,
                files: 2,
                allowed: ['jpeg', 'png']
            }
        });

        expect(upload.options.dest).eql(os.tmpdir());
        expect(upload.options.limits.fileSize).eql(1024 * 1024);
        expect(upload.options.limits.files).eql(2);
        expect(upload.options.limits.allowed[0]).eql('jpeg');
        expect(upload.options.limits.allowed[1]).eql('png');
    });

    it('should instantiate CryptoBusBoy module withOut Crypto support', async () => {
        const upload = new CryptoBusBoy({
            dest: Helper.getUploadServerFolder(),
            limits: {
                fileSize: 1024 * 1024,
                files: 2,
                allowed: ['jpeg', 'png']
            }
        });

        expect(upload._crypto_mode).eql(false);
        expect(upload.cipher).eql(null);
        expect(upload.options.dest).eql(Helper.getUploadServerFolder());
        expect(upload.options.limits.fileSize).eql(1024 * 1024);
        expect(upload.options.limits.files).eql(2);
        expect(upload.options.limits.allowed[0]).eql('jpeg');
        expect(upload.options.limits.allowed[1]).eql('png');
    });

    it('should instantiate CryptoBusBoy module with Crypto support', async () => {
        const upload = new CryptoBusBoy({
            key: 'kokoa'
        });

        expect(upload._crypto_mode).eql(true);
        expect(upload.options.key).eql('kokoa');
        expect(upload.cipher.key.constructor.name).eql('Buffer');
        expect(upload.cipher.constructor.name).eql('Cryptonite');
        expect(upload.options.dest).eql(os.tmpdir());
        expect((Object.keys(upload.options.limits)).length).eql(0);
    });
};
