const devNull = require('dev-null');
const {it} = require("mocha");
const {expect} = require("chai");
const fs = require('fs');

module.exports = function suite(Detector) {

    it('Should data-detector timeout', done => {
        const detector = new Detector({timeOut: 200});
        const readable = fs.createReadStream('/dev/urandom');

        detector.detect_timeout(() => {
            done()
        });

        readable.pipe(detector).pipe(devNull());

        setTimeout(() => {
            readable.unpipe();
        }, 100);

        readable.pipe(detector).pipe(devNull());

    });

    it('Should disable data-detector timeout', done => {
        const detector = new Detector({timeOut: 0});
        const readable = fs.createReadStream('/dev/urandom');

        detector.detect_timeout(() => {
            done(new Error('detector not disabled'))
        });

        readable.pipe(detector).pipe(devNull());

        setTimeout(() => {
            readable.unpipe();
            setTimeout(() => {
                done()
            }, 100)
        }, 200);

        readable.pipe(detector).pipe(devNull());

    });
};
