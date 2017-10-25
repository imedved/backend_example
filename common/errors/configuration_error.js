/**
 * @param {string} message
 * @param {number=} statusCode
 * @constructor
 */
function ConfigurationError(message, statusCode) {
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.message = message || 'Bad configuration';
    this.statusCode = statusCode || 500;
}

require('util').inherits(ConfigurationError, Error);

module.exports = ConfigurationError;