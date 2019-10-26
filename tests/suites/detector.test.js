const devNull = require('dev-null');
const {it} = require("mocha");
const {expect} = require("chai");
const Helper = require('../lib/helper');
const fs = require('fs');
const uuid = require('uuid/v1');
const path = require('path');

module.exports = function suite(Detector) {

    it('Should have stream method returns transform stream', (done) => {
        const detector = new Detector;
        const transStream = detector.stream();
        expect(transStream.constructor.name).eq('StreamTypeTransform');
        expect(transStream.readable).eq(true);
        expect(transStream.writable).eq(true);
        done();
    });

    it('Should have a Promise detect method', (done) => {
        const detector = new Detector;
        const promise = detector.detect();
        expect(promise.constructor.name).eq('Promise');
        done();
    });

    it('Should pass data untouched', async () => {
        const detector = new Detector;

        const dest1 = path.join(Helper.getUploadServerFolder(), uuid() + '-untouched.through');
        const dest2 = path.join(Helper.getUploadServerFolder(), uuid() + '-untouched');

        await fs.createReadStream(Helper.files().ftxt)
            .pipe(detector.stream())
            .pipe(fs.createWriteStream(dest1))
            .on('error', (e) => {
                console.error('Fs test Error', e)
            });

        await  fs.createReadStream(Helper.files().ftxt)
            .pipe(fs.createWriteStream(dest2))
            .on('error', (e) => {
                console.log(e)
            });

        expect(Helper.md5File(dest1)).eq(Helper.md5File(dest2));
    });


    it('Should detect jpg file', done => {
        const detector = new Detector;
        const readable = fs.createReadStream(Helper.files().f1);
        detector.detect()
            .then(type => {
                if (type) {
                    expect(type.ext).eq('jpg');
                    done();
                } else {
                    done('not found')
                }
            });

        readable
            .pipe(detector.stream())
            .pipe(devNull());
    });

    it('Should detect docx file', done => {
        const detector = new Detector;
        const readable = fs.createReadStream(Helper.files().f1docx);
        detector.detect()
            .then(type => {
                expect(type.ext).eq('docx');
                done();
            });

        readable
            .pipe(detector.stream())
            .pipe(devNull());
    });

    it('Should detect original.doc as msi file', done => {
        const detector = new Detector;
        const readable = fs.createReadStream(Helper.files().f1doc);
        detector.detect()
            .then(type => {
                if (type) {
                    expect(type.ext).eq('msi');
                    done();
                }
            });

        readable
            .pipe(detector.stream())
            .pipe(devNull());
    });
};
