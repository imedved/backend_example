/**
 * @param {string} message
 * @param {number=} statusCode
 * @param {string=} code
 * @constructor
 */
function AuthError(message, statusCode, code) {
	Error.captureStackTrace(this, this.constructor);
	this.name = this.constructor.name;
	this.message = message || 'Authorization Required';
	this.statusCode = statusCode || 401;
}

require('util').inherits(AuthError, Error);

module.exports = AuthError;
