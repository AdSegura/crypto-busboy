'use strict';
const chai = require('chai');
const {describe, it} = require('mocha');
const expect = chai.expect;
chai.should();
const fs = require('fs');
const path = require('path');
const md5 = require("md5");
const {binaryParser} = require('../lib/binaryParser');
const Helper = require('../lib/helper');

module.exports = function suite(mode) {

    const upload_options = {
        alg:'aes256',
        dest: Helper.getUploadServerFolder(),
        limits: {
            fileSize: 1024 * 1024,
            files: 2,
            allowed: ['jpeg', 'png']
        }
    };

    if (mode === 'crypto')
        upload_options.key = 'super-password';

    describe('test upload limit size and deleted failed files', () => {
        let f1FullPath;

        it('Should FAIL upload 1.1Mb file with limit 1Mb', async () => {
            const agent = Helper.factoryAgent(upload_options);
            const res = await agent
                .post(Helper.urls().upload)
                .attach('my photo 1', Helper.files().f1);

            res.should.have.status(400);
            res.body.errors[0].should.have.property('filename').eql(Helper.getFileName('f1'));
            res.body.errors[0].should.have.property('error').eql('BYTES LIMIT EXCEEDED, limit 1048576 bytes');
            f1FullPath = res.body.errors[0].fullPath;

        });

        it('Should Check Previous failed file has been deleted', done => {
            fs.stat(f1FullPath, (e) => {
                e.code.should.eql('ENOENT');
                done();
            })
        });
    });

    describe('test for upload/download f2.jpeg', () => {
        let fileUploaded1;

        it('Should upload file f2.jpeg with with busopt limits', async () => {
            const agent = Helper.factoryAgent(upload_options);
            const res = await agent
                .post(Helper.urls().upload)
                .attach('my photo 2', Helper.files().f2);

            res.should.have.status(200);
            res.body.files[0].should.have.property('filename').eql(Helper.getFileName('f2'));
            res.body.files[0].should.have.property('error').eql(null);
            fileUploaded1 = res.body.files[0].fullname;
        });


        it(`Should Download previously uploaded file, mode [${mode}] f2.jpeg and MD5 check`, async () => {
            const agent = Helper.factoryAgent(upload_options);
            const res = await agent
                .get(`${Helper.urls().getFile}/${fileUploaded1}`)
                .buffer()
                .parse(binaryParser);

            res.should.have.status(200);
            expect(md5(res.body)).to.equal(Helper.md5File(Helper.files().f2));
        });
    });

    describe('test upload limit files', () => {
        let fileUploaded1,
            fileUploaded2,
            fileUploaded1_real_name,
            fileUploaded2_real_name;

        const file_names = [
            Helper.getFileName('f2'),
            Helper.getFileName('f3'),
            Helper.getFileName('f4'),
            Helper.getFileName('f5')
        ];

        it('Should Upload 5 files limit is 2, Ok two files, get warning = MAX FILES REACHED', async () => {

            const agent = Helper.factoryAgent(upload_options);
            const res = await agent
                .post(Helper.urls().upload)
                .attach('my photo 2', Helper.files().f2)
                .attach('my photo 3', Helper.files().f3)
                .attach('my photo 4', Helper.files().f4)
                .attach('my photo 5', Helper.files().f5);

            //console.log(res)
            res.should.have.status(429);
            expect(res.body.files.length).eq(2);
            expect(file_names.includes(res.body.files[0].filename)).eq(true);
            expect(file_names.includes(res.body.files[1].filename)).eq(true);

            res.body.warnings[0].should.eql('MAX FILES REACHED, LIMIT IS 2 FILES');
            res.body.files[0].should.have.property('error').eql(null);
            res.body.files[1].should.have.property('error').eql(null);

            fileUploaded1 = res.body.files[0].fullname;
            fileUploaded2 = res.body.files[1].fullname;
            fileUploaded1_real_name = res.body.files[0].filename.split('.')[0];
            fileUploaded2_real_name = res.body.files[1].filename.split('.')[0];
        });


        it(`Should Download two files previously uploaded mode [${mode}] and MD5 check`, async () => {
            const agent = Helper.factoryAgent(upload_options);
            const res = await agent
                .get(`${Helper.urls().getFile}/${fileUploaded1}`)
                .buffer()
                .parse(binaryParser);

            res.should.have.status(200);
            expect(md5(res.body)).to.equal(Helper.md5File(Helper.files()[fileUploaded1_real_name]));

            const res1 = await agent
                .get(`${Helper.urls().getFile}/${fileUploaded2}`)
                .buffer()
                .parse(binaryParser);

            res1.should.have.status(200);
            expect(md5(res1.body)).to.equal(Helper.md5File(Helper.files()[fileUploaded2_real_name]));
        });

    });

    describe('test upload limit file types', () => {
        let fileUploaded1, fileUploaded1_real_name;

        it(`Should Upload 2 files, f3.jpeg allowed, docsZip mot allowed mode [${mode}]`, async () => {
            const agent = Helper.factoryAgent(upload_options);
            const res = await agent
                .post(Helper.urls().upload)
                .attach('my photo 3', Helper.files().f3)
                .attach('my.docx', Helper.files().f2docxZip);

            res.should.have.status(429);
            res.body.files[0].should.have.property('filename').eql(Helper.getFileName('f3'));
            res.body.files[0].should.have.property('error').eql(null);
            res.body.errors[0].should.have.property('error').eql('EXTENSION NOT ALLOWED docx');

            fileUploaded1 = res.body.files[0].fullname;
            fileUploaded1_real_name = res.body.files[0].filename.split('.')[0];
        });


        it(`Should Download previously upload file mode [${mode}] and MD5 check`, async () => {
            const agent = Helper.factoryAgent(upload_options);
            const res = await agent
                .get(`${Helper.urls().getFile}/${fileUploaded1}`)
                .buffer()
                .parse(binaryParser);

            expect(res).to.have.status(200);
            expect(md5(res.body)).to.equal(Helper.md5File(Helper.files()[fileUploaded1_real_name]));
        });
    });

    it(`Should Upload file with extra form fields mode [${mode}]`, async () => {
        const agent = Helper.factoryAgent(upload_options);
        const res = await agent
            .post(Helper.urls().upload)
            .attach('my photo 4', Helper.files().f4)
            .field("avatar", "true");


        res.should.have.status(200);
        res.body.files[0].should.have.property('filename').eql(Helper.getFileName('f4'));
        res.body.files[0].should.have.property('error').eql(null);
        res.body.fields[0].should.have.property('avatar').eql("true");
    });

    it('Should FAIL upload Xsl/Access files', async () => {
        const agent = Helper.factoryAgent(upload_options);
        const res = await agent
            .post(Helper.urls().upload)
            .attach('my excel', Helper.files().f1excel)
            .attach('my access', Helper.files().f1access);

        res.should.have.status(400);
        res.body.errors[0].should.have.property('filename').eql(Helper.getFileName('f1excel'));
        res.body.errors[0].should.have.property('error').eql('EXTENSION NOT ALLOWED xlsx');
        res.body.errors[1].should.have.property('filename').eql(Helper.getFileName('f1access'));
        res.body.errors[1].should.have.property('error').eql('EXTENSION NOT ALLOWED mdb');
    });

    it('Should FAIL to upload pptx file', async () => {
        const agent = Helper.factoryAgent(upload_options);
        const res = await agent
            .post(Helper.urls().upload)
            .attach('my ppt', Helper.files().f1ppt);

        res.should.have.status(400);
        res.body.errors[0].should.have.property('filename').eql(Helper.getFileName('f1ppt'));
        res.body.errors[0].should.have.property('error').eql('EXTENSION NOT ALLOWED pptx')

    });

    it('Should FAIL to upload ZIP file', async () => {
        const agent = Helper.factoryAgent(upload_options);
        const res = await agent
            .post(Helper.urls().upload)
            .attach('my zip', Helper.files().f1zip);

        res.should.have.status(400);
        res.body.errors[0].should.have.property('filename').eql(Helper.getFileName('f1zip'));
        res.body.errors[0].should.have.property('error').eql('EXTENSION NOT ALLOWED zip');
    });
};

