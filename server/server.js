'use strict';

let loopback = require('loopback');
let boot = require('loopback-boot');
let app = module.exports = loopback();
let path = require('path');
let busboy = require('connect-busboy');
let session = require('express-session');
let Memcached = require('memcached');

let log4js = require('../common/utils').log4js;
let config = require('./config.local');

let logLevel = config.logLevel;

let mainLogger = log4js.fork('Main', logLevel);
let expressLogger = log4js.fork('Express', logLevel);

/**
 * Cache configuration
 */
let memcachedServers = config.memcachedServers.split(',');
app.cacheClient = new Memcached(memcachedServers);

/**
 * App configuration
 */
app.use(session({
    secret: config.sessionSecret,
    cookie: { maxAge: config.sessionMaxAge },
    resave: true,
    saveUninitialized: true
}));
app.use(loopback.context());
app.use(require('cookie-parser')());
app.use(require('body-parser').urlencoded({ extended: true }));
app.use(log4js.connectLogger(expressLogger, { level: log4js.levels.DEBUG, format: ':method :status :url' }));
app.use(busboy({ limits: { files: 1 } }));

if (app.get('env') === 'dev') {
    app.get('/upload', (req, res) => {
        res.sendFile(path.join(__dirname + '/../public/index.html'), (err) => {
            if (err) {
                res.send(err);
            }
        })
    });
}

/**
 * App start
 */
app.start = () => {
    return app.listen(() => {
        app.emit('started');
        let baseUrl = app.get('url').replace(/\/$/, '');
        mainLogger.info(`Web server listening at: ${baseUrl}, process: ${process.pid}, configuration: ${JSON.stringify(config)}`);
    });
};

boot(app, __dirname, (err) => {
    if (err) throw err;
    if (require.main === module) app.start();
});
