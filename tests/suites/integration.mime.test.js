'use strict';
const chai = require('chai');
const {describe, it} = require('mocha');
const expect = chai.expect;
chai.should();
const Helper = require('../lib/helper');
const path = require('path');


module.exports = function suite(mode) {


    it('Should upload txt file', async () => {
        const upload_options = Helper.factoryUpOptions_allowed(['txt'], mode);
        const agent = Helper.factoryAgent(upload_options);

        const res = await agent
            .post(Helper.urls().upload)
            .attach('my txt', Helper.files().ftxt);

        console.log(res.text);
        res.should.have.status(200);
        res.body.files[0].should.have.property('filename').eql(Helper.getFileName('ftxt'));
        res.body.files[0].should.have.property('fieldname').eql('my txt');
        expect(Helper.checkFileExist(res.body.files[0].fullPath)).eql(true);
    });

    it('Should upload mdb file', async () => {
        const upload_options = Helper.factoryUpOptions_allowed(['mdb'], mode);
        const agent = Helper.factoryAgent(upload_options);

        const res = await agent
            .post(Helper.urls().upload)
            .attach('my mdb', Helper.files().f1access);

        res.should.have.status(200);
        res.body.files[0].should.have.property('filename').eql(Helper.getFileName('f1access'));
        res.body.files[0].should.have.property('fieldname').eql('my mdb');
        expect(Helper.checkFileExist(res.body.files[0].fullPath)).eql(true);
    });

    it('Should upload doc as msi file', async () => {
        const upload_options = Helper.factoryUpOptions_allowed(['msi'], mode);
        const agent = Helper.factoryAgent(upload_options);

        const res = await agent
            .post(Helper.urls().upload)
            .attach('my doc', Helper.files().f1doc);

        res.should.have.status(200);
        res.body.files[0].should.have.property('filename').eql(Helper.getFileName('f1doc'));
        res.body.files[0].should.have.property('fieldname').eql('my doc');
        expect(Helper.checkFileExist(res.body.files[0].fullPath)).eql(true);
    });
};
