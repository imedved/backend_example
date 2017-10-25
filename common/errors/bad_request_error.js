/**
 * @param {string} message
 * @param {number=} statusCode
 * @param {string=} code
 * @constructor
 */
function BadRequestError(message, statusCode, code) {
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.message = message || 'Bad Request';
    this.statusCode = statusCode || 400;
}

require('util').inherits(BadRequestError, Error);

module.exports = BadRequestError;

