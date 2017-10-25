/**
 * @param {string} message
 * @param {number=} statusCode
 * @param {string=} code
 * @constructor
 */
function AccessError(message, statusCode, code) {
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.message = message || 'Forbidden';
    this.statusCode = statusCode || 403;
}

require('util').inherits(AccessError, Error);

module.exports = AccessError;