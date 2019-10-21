'use strict';
const chai = require('chai');
const {describe, it} = require('mocha');
const expect = chai.expect;
chai.should();
const Helper = require('../lib/helper');

module.exports = function suite(mode) {

    const upload_options = {
        dest: Helper.getUploadServerFolder(),
        limits: {
            fileSize: 50 * 1024 * 1024,
            files: 2,
            allowed: ['docx']
        }
    };

    if (mode === 'crypto')
        upload_options.key = 'super-password';

    describe('test crypto-busboy custom destination file', () => {

        it('Should upload to a custom path', async () => {
            const agent = Helper.factoryAgent(upload_options);
            const res = await agent
                .post(Helper.urls().upload_custom)
                .attach('my docx', Helper.files().f1docx);

            res.should.have.status(200);
            res.body.files[0].should.have.property('filename').eql(Helper.getFileName('f1docx'));
            res.body.files[0].should.have.property('fieldname').eql('my docx');
            const file_path = res.body.files[0].folder;
            expect(Helper.checkFileExist(file_path)).eql(true);
        });
    })
};
