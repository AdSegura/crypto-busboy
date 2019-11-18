'use strict';
const {describe, before, after} = require('mocha');
const upload_class_suite = require('./suites/upload.class.test');
const errors_suite = require('./suites/error.test');
const errors_integration_suite = require('./suites/error.integrator.test');
const integration_suite = require('./suites/integration.test');
const integration_remote_stream = require('./suites/integration.remote.test');
const integration_big_file_suite = require('./suites/integration.bigfile.test');
const integration_custom_suite = require('./suites/integration.test.custom.dest');
const timeout_suite = require('./suites/timeout.test');

const Helper = require('./lib/helper');
const CryptoBusBoy = require('../src');
const DetectorTimeOut = require('../src/lib/detector-timeout');

let bigSize;

/** Script mode */
if (process.argv.includes('--big_file_size')) {
    const argPosition = process.argv.indexOf('--big_file_size') + 1;
    bigSize = process.argv[argPosition];
}

const size = bigSize || '100mb';

before(function(done){
    this.timeout(30000);
    console.log('\x1b[36m%s\x1b[0m', " (\u279C) Checking test prerequisites, please wait...\n");
    Helper.before()
        .then(done)
        .catch(e => {throw e});
});

after(function (done) {
    this.timeout(8000);
    Helper.after();
    process.nextTick(done);
});

describe('Test crypto-busboy Module',
    upload_class_suite.bind(this, CryptoBusBoy));

describe('Test crypto-busboy module errors',
    errors_suite.bind(this, CryptoBusBoy));

describe('Test Integration Upload/Download Crypto Mode within expressJS',
    integration_suite.bind(this, 'crypto'));

describe('Test Integration Upload/Download No Crypto Mode within expressJS',
    integration_suite.bind(this, 'no_crypto'));

describe('Test Integration remote stream no_crypto',
    integration_remote_stream.bind(this, 'no_crypto'));

describe('Test Integration remote stream crypto',
    integration_remote_stream.bind(this, 'crypto'));

describe('Test Integration Upload/Download Big File Crypto Mode within expressJS',
    integration_big_file_suite.bind(this, 'crypto', size));

describe('Test Integration Upload/Download Big File No Crypto Mode within expressJS',
    integration_big_file_suite.bind(this, 'no_crypto', size));

describe('Test Integration Error',
    errors_integration_suite.bind(this));

describe('Test Integration Custom options',
    integration_custom_suite.bind(this));

describe('Test timeout Detector Stream',
    timeout_suite.bind(this, DetectorTimeOut));

