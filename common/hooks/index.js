'use strict';

let uuid = require('uuid');

let app = require('../../server/server');
let log4js = require('../utils').log4js;
let crypto = require('../utils/index').crypto;
let filter = require('./lib/utils').hookFilter;
let awsRepository = require('../repositories').aws;

let ContextManager = require('./lib/context_manager');
let Injector = require('./lib/injector');
let FileManager = require('./lib/file_manager');
let NewsfeedGenerator = require('./lib/newsfeed_generator');

let logLevel = app.get('logLevel');
let contextManagerLogger = log4js.fork('ContextManager', logLevel);
let newsfeedGeneratorLogger = log4js.fork('NewsfeedGenerator', logLevel);
let fileManagerLogger = log4js.fork('FileManager', logLevel);

module.exports = {
    contextManager: new ContextManager(app, crypto, filter, contextManagerLogger),
    newsfeedGenerator: new NewsfeedGenerator(app, newsfeedGeneratorLogger),
    injector: new Injector(app, filter),
    fileManager: new FileManager(app, awsRepository, uuid, filter, fileManagerLogger, {
        cdnRoute: app.get('cdnRoute')
    })
};