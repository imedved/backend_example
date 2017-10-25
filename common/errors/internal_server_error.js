/**
 * @param {string} message
 * @param {number=} statusCode
 * @param {string=} code
 * @constructor
 */
function InternalServerError(message, statusCode, code) {
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.message = message || 'Internal Server Error';
    this.statusCode = statusCode || 500;
}

require('util').inherits(InternalServerError, Error);

module.exports = InternalServerError;