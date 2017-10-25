'use strict';

var AuthError = require('../../errors/auth_error');
var InternalServerError = require('../../errors/internal_server_error');

/**
 * @param {Object} excludeMethods
 * @returns {Function}
 */
function checkAuthError(excludeMethods) {
    excludeMethods = excludeMethods || {};
    return function (context, next) {
        var method = context.methodString;

        if (context.error.type) {
            switch (context.error.type) {
                case 'OAuthException': {
                    let excludeMethodListName = 'authError';
                    if (isMethodExcluded(excludeMethods[excludeMethodListName], method))  return next();
                    return next(new AuthError(context.error.message));
                }
                default: {
                    let excludeMethodListName = 'defaultError';
                    if (isMethodExcluded(excludeMethods[excludeMethodListName], method))  return next();
                    return next(new InternalServerError(context.error.message))
                }
            }
        }

        next();
    }
}

/**
 * @param {Array} excludedList
 * @param {string} method
 * @returns {*|boolean}
 */
function isMethodExcluded(excludedList, method) {
    return (excludedList && excludedList.indexOf(method) > -1)
}

module.exports = {
    checkAuthError: checkAuthError
};
