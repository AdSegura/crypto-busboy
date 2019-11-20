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
const http = require('http');
const uuid = require('uuid/v1');

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

    describe('test remote writeStream', () => {
        it(`Should fail to Upload 1 file to an unavailable remote http writeStream server, mode [${mode}]`, async () => {

            /* setup remote upload endpoint server **/
            // const remote_server = Helper.express({});
            // remote_server.listen();

            const dest = {
                protocol: 'http',
                path: `http://localhost:${4000}/file/`,
                createWriteStream: (filename) => {
                    return http.request({port: 4000, path: `/upload_pipe/${filename}`, method: 'post'})
                },
                deleteFailedStream: (filename) => {
                    return http.request({port: 4000, path: `/delete/${filename}`, method: 'delete'});
                }
            };

            const opt = {...cloneDeep(upload_options), ...{dest}};

            const agent = Helper.factoryAgent(opt);

            const res = await agent
                .post(Helper.urls().upload)
                .attach('my photo 2', Helper.files().f2);

            res.should.have.status(500);
        });

        it(`Should fail to Upload 1 file to non existing url within remote http writeStream server, mode [${mode}]`, async () => {

            /* setup remote upload endpoint server **/
            const remote_server = Helper.express({});
            remote_server.listen();

            const dest = {
                protocol: 'http',
                path: `http://localhost:${remote_server.address().port}/file/`,
                createWriteStream: (filename) => {
                    return http.request({
                        port: remote_server.address().port,
                        path: `/foo/${filename}`,
                        method: 'get' // WTF change this to POST and StatusCode will be what should be 404
                    })
                }
            };

            const opt = {...cloneDeep(upload_options), ...{dest}};

            const agent = Helper.factoryAgent(opt);

            const res = await agent
                .post(Helper.urls().upload)
                .attach('my photo 2', Helper.files().f2);

            //Todo wtf? if GET to non existing url will get 400 statusCode, if POST 404
            res.body.should.have
                .property('error')
                .eql('UploadError: remote http Upload endpoint statusCode: 400, statusMessage: Bad Request');

            res.should.have.status(500);
        });

        describe('Success stream remote upload', () => {
            let fileUploaded, fileUploaded_name;
            it(`Should Upload 1 file to remote http writeStream server, mode [${mode}]`, async () => {
                /* setup remote upload endpoint server **/
                const remote_server = Helper.express({});
                remote_server.listen();
                const http_path = `http://localhost:${remote_server.address().port}/file/`;
                const dest = {
                    protocol: 'http',
                    path: http_path,
                    createWriteStream: (filename) => {
                        return http.request({
                            port: remote_server.address().port,
                            path: `/upload_pipe/${filename}`,
                            method: 'post'
                        })
                    }
                };
                const opt = {...cloneDeep(upload_options), ...{dest}};
                const agent = Helper.factoryAgent(opt);
                const res = await agent
                    .post(Helper.urls().upload)
                    .attach('my photo 2', Helper.files().f2);

                fileUploaded = res.body.files[0].fullname;
                fileUploaded_name = res.body.files[0].filename.split('.')[0];

                res.should.have.status(200);
                res.body.files[0].should.have
                    .property('filename')
                    .eql(Helper.getFileName('f2'));
                res.body.files[0].should.have
                    .property('folder')
                    .eql(http_path);
            });

            it(`Should Download previously upload file mode [${mode}] and MD5 check`, async () => {
                const agent = Helper.factoryAgent(upload_options);
                const res = await agent
                    .get(`${Helper.urls().getFile}/${fileUploaded}`)
                    .buffer()
                    .parse(binaryParser);

                expect(res).to.have.status(200);
                expect(md5(res.body)).to.equal(Helper.md5File(Helper.files()[fileUploaded_name]));
            });
        });
    });

    describe('test http request stream remote upload', () => {
        it(`Should upload file to remote server through http.request stream, mode [${mode}]`, done => {

            // writeStream from http.request always call event finish even if
            // request to remote server fails...
            // to ensure data has been written to remote http location
            // we have to listen for a response event
            const remote_server = Helper.express({});
            remote_server.listen();
            fs.createReadStream(Helper.files().f2)
                .pipe(http.request({
                    port: remote_server.address().port,
                    path: `/upload_pipe/${uuid()}.png`,
                    method: 'post'
                }))
                .on('error', e => {
                    console.log('Error', e)
                })
                .on('response', res => {
                    expect(res.statusCode).eq(200);
                    done();
                })
            //.on('finish', () => console.log('Finish request upload'))
        })
    });
};
