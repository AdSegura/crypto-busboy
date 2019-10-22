'use strict';
const {it, before, after} = require('mocha');
const chai = require('chai');
chai.should();
const expect = chai.expect;
const fs = require('fs');
const Helper = require('../../../lib/helper');
const request = require('request');

module.exports = function suite(server) {


    it('Should fail upload one file limit bytes',  (done) => {
        const formData = {
            my_field: 'my_value',
            my_file: fs.createReadStream(Helper.files().f1)
        };

        request.post({
                url:`http://localhost:${server.address().port}/busboy`,
                formData: formData},
            (err, httpResponse, res) => {
                if (err) return console.error('upload failed:', err);
                httpResponse.should.have.status(400);
                done()
            });
    });

    it('Should upload one file',  (done) => {
        const formData = {
            my_field: 'f2 foo',
            my_file: fs.createReadStream(Helper.files().f2)
        };

        request.post({
                url:`http://localhost:${server.address().port}/busboy`,
                formData: formData},
            (err, httpResponse, res) => {
                if (err) return console.error('upload failed:', err);
                httpResponse.should.have.status(200);
                done()
            });
    });
}
