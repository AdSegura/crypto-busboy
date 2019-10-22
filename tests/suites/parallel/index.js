'use strict';
const {describe, before, after} = require('mocha');
const parallel_suite = require('./suites/parallel.test');
const parallel1_suite = require('./suites/parallel_1.test');

const Helper = require('../../lib/helper');
const CryptoBusBoy = require('../../../src');
const Detector = require('../../../src/lib/fileTypeDetector');
const DetectorTimeOut = require('../../../src/lib/detector-timeout');

let express = Helper.express({
    dest: Helper.getUploadServerFolder(),
    limits: {
        fileSize: 1024 * 1024,
        files: 2
    }
});

const server = express.listen();

after(function (done) {
    server.close();
    Helper.after();
    done();
});

describe('Test parallel',
    parallel_suite.bind(this, server));
describe('Test parallel 1',
   parallel1_suite.bind(this, server));
