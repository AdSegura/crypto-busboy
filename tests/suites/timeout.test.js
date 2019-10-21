const devNull = require('dev-null');
const {it} = require("mocha");
const {expect} = require("chai");
const fs = require('fs');

module.exports = function suite(Detector) {

    it('Should data-detector timeout', (done) => {
        const detector = new Detector({timeOut: 1000});
        const readable = fs.createReadStream('/dev/urandom');

        detector.detect_timeout(() => {
            done()
        });

        setTimeout(() => {
            readable.unpipe();
            setTimeout(()=> {
                readable.pipe(detector).pipe(devNull());
            },2000)
            //done();
        }, 600);

        readable.pipe(detector).pipe(devNull());

    }).timeout(5000)
};
