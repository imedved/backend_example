'use strict';

let log4js = require('log4js');
log4js.configure({
    appenders: [{ type: 'console', layout: { type: 'basic' } }],
    replaceConsole: true
});

/**
 * @param {string} loggerName
 * @param {string} logLevel
 * @returns {Logger}
 */
log4js.fork = (loggerName, logLevel) => {
    let logger = log4js.getLogger(`[${process.pid}] - ${loggerName}`);
    logger.setLevel(logLevel);
    return logger;
};

module.exports = log4js;
