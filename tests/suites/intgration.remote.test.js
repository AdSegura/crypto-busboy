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

// test upload limits... how to remove failed created file at remote location

// test upload to remote location
    // start server 1 stream mode port 3000
    // start server 2 cipher mode port 4000
    // upload file to server 1
    // test file uploaded successfully to server 2 downloading it and md5 it
