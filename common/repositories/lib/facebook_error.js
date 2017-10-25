/**
 * @param {string} message
 * @param {number=} statusCode
 * @param {string=} code
 * @constructor
 */
function FacebookError(message, statusCode, code) {
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.message = message || 'FacebookError';
    this.statusCode = statusCode || 401;
}

require('util').inherits(FacebookError, Error);

module.exports = FacebookError;
