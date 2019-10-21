'use strict';
const {it, before, after} = require('mocha');
const chai = require('chai');
const expect = chai.expect;
const fs = require('fs');
const Helper = require('../lib/helper');
const request = require('request');

module.exports = function suite(mode, size) {

    before(async function() {
        this.timeout(30000);
        await Helper.seeIfIHaveToMakeBigFile(size);
    });

   /* after(async () => {
        await Helper.removeBigFile();
    });*/

    const upload_options = {
        dest: Helper.getUploadServerFolder(),
        limits: {
            fileSize: 1024 * 1024,
            files: 1
        }
    };

    if (mode === 'crypto')
        upload_options.key = 'super-password';

    let f1FullPath, f1BigFileNewName;


    it('Should FAIL upload Big file with limit 1Mb',  (done) => {
        let express = Helper.express({
            dest: Helper.getUploadServerFolder(),
            limits: {
                fileSize: 1024 * 1024,
                files: 1
            }
        });

        const server = express.listen();

        const formData = {
            my_field: 'my_value',
            my_file: fs.createReadStream(Helper.files().bigFile)
        };

        request.post({
                url:`http://localhost:${server.address().port}/busboy`,
                formData: formData},
            (err, httpResponse, res) => {
                if (err) return console.error('upload failed:', err);
                httpResponse.should.have.status(400);
                res = JSON.parse(res);
                res.errors[0].should.have.property('error').eql('BYTES LIMIT EXCEEDED, limit 1048576 bytes');
                f1FullPath = res.errors[0].fullPath;
                server.close(done)
            });
    }).timeout(99000);

    it('Should Check Previous failed file has been deleted', done => {
        if(! f1FullPath) done('No file found');
        fs.stat(f1FullPath, (e) => {
            e.code.should.eql('ENOENT');
            done();
        })
    });

    it('Should upload BigFile',  (done) => {
        let express = Helper.express({
            dest: Helper.getUploadServerFolder(),
            limits: {
                fileSize: 50000 * 1024 * 1024,
                files: 1
            }
        });

       const server = express.listen();

        const formData = {
            my_field: 'my_value',
            my_file: fs.createReadStream(Helper.files().bigFile)
        };

        request.post({
                url:`http://localhost:${server.address().port}/busboy`,
                formData: formData},
                (err, httpResponse, res) => {
                    if (err) return console.error('upload failed:', err);
                    httpResponse.should.have.status(200);
                    res = JSON.parse(res);
                    res.files[0].should.have.property('filename').eql(Helper.getFileName('bigFile'));
                    res.files[0].should.have.property('error').eql(null);
                    f1BigFileNewName = res.files[0].fullname;
                    server.close(done)
        });

    }).timeout(99000);

    it('Should Download big file and MD5 check',  (done) => {
        const downloadBigFilePath = Helper.getUploadServerFolder() + '/big.file_downloaded';

        const agent = Helper.factoryAgent(upload_options);

        const req = agent
            .get(`${Helper.urls().getFile}/${f1BigFileNewName}`);

        const writeStream = fs.createWriteStream(downloadBigFilePath, { encoding: 'utf8' });

        writeStream.on('finish', () => {
            expect(Helper.md5File(downloadBigFilePath)).to.equal(Helper.md5File(Helper.files().bigFile));
            done()
        });

        req.pipe(writeStream);

    }).timeout(99000);

    it('Should Cancel BigFile',  (done) => {
        let express = Helper.express({
            timeOut: 200,
            dest: Helper.getUploadServerFolder(),
            limits: {
                fileSize: 50000 * 1024 * 1024,
                files: 1
            }
        });

        const server = express.listen();
        const readable = fs.createReadStream(Helper.files().bigFile);

        readable.once('data', () => {
            setTimeout(() => {
                readable.close();
            },0)
        });

        const formData = {
            my_field: 'my_value',
            my_file: readable
        };

        request.post({
                url:`http://localhost:${server.address().port}/busboy`,
                formData: formData},
            (err, httpResponse, res) => {
                if (err) return console.error('upload failed:', err);
                httpResponse.should.have.status(500);
                res = JSON.parse(res);
                res.error.should.eql('Error: REQUEST TIMEOUT');
                server.close(done)
            });

    }).timeout(97000);
};
