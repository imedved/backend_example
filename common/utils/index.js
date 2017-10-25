'use strict';

let Crypto = require('./lib/crypto');
let log4js = require('./lib/log4js');
let caseConverter = require('./lib/case_converter');

module.exports = {
    crypto: new Crypto(),
    log4js: log4js,
    caseConverter: caseConverter
};
