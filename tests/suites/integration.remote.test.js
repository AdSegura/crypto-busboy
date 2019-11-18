'use strict';
const chai = require('chai');
const {describe, it} = require('mocha');
const expect = chai.expect;
chai.should();
const fs = require('fs');
const md5 = require("md5");
const {binaryParser} = require('../lib/binaryParser');
const Helper = require('../lib/helper');
const path = require('path');
const mkdirp = require('mkdirp');
const cloneDeep = require('lodash/cloneDeep');

// test upload limits... how to remove failed created file at remote location

// test upload to remote location
    // start server 1 stream mode port 3000
    // start server 2 cipher mode port 4000
    // upload file to server 1
    // test file uploaded successfully to server 2 downloading it and md5 it

module.exports = function suite(mode) {

    const upload_options = {
        alg: 'aes256',
        dest: Helper.getUploadServerFolder(),
        limits: {
            fileSize: 1024 * 1024,
            files: 2,
            allowed: ['jpeg', 'png']
        }
    };

    if (mode === 'crypto')
        upload_options.key = 'super-password';

    describe('test upload destination is a writeStream', () => {
        let fileUploaded1, fileUploaded1_real_name;
        const dir = '/tmp/uptest/' + (new Date).getMilliseconds();

        it(`Should Upload 1 file to custom writeStream, mode [${mode}]`, async () => {
            const dest = {
                createWriteStream: (filename) => {
                    mkdirp.sync(dir);
                    return fs.createWriteStream(path.join(dir, filename))
                },
                path: 'server1://'
            };

            const opt = {...cloneDeep(upload_options), ...{dest}};

            const agent = Helper.factoryAgent(opt);
            const res = await agent
                .post(Helper.urls().upload)
                .attach('my photo 2', Helper.files().f2);

            res.should.have.status(200);
            res.body.files[0].should.have.property('filename').eql(Helper.getFileName('f2'));
            res.body.files[0].should.have.property('error').eql(null);

            fileUploaded1 = res.body.files[0].fullname;
            fileUploaded1_real_name = res.body.files[0].filename.split('.')[0];
        });


        it(`Should Download previously upload file mode [${mode}] and MD5 check`, async () => {
            const opt = {...cloneDeep(upload_options), ...{dest: dir}};

            const agent = Helper.factoryAgent(opt);

            const res = await agent
                .get(`${Helper.urls().getFile}/${fileUploaded1}`)
                .buffer()
                .parse(binaryParser);

            expect(res).to.have.status(200);
            expect(md5(res.body)).to.equal(Helper.md5File(Helper.files()[fileUploaded1_real_name]));
        });
    });

    /*describe('test remote writeStream', () => {
        it(`Should Upload 1 file to remote writeStream server, mode [${mode}]`, async () => {
            const dest = {
                createWriteStream: (filename) => {
                    mkdirp.sync(dir);
                    return fs.createWriteStream(path.join(dir, filename))
                },
                path: 'server1://'
            };

            const opt = {...cloneDeep(upload_options), ...{dest}};

            const agent = Helper.factoryAgent(opt);
            const res = await agent
                .post(Helper.urls().upload)
                .attach('my photo 2', Helper.files().f2);

            res.should.have.status(200);
        });
    });*/
};
