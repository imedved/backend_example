'use strict';

module.exports.hookFilter = (method, options, callback) => {
    options = options || {};
    let exclude = options.exclude || null;
    let include = options.include || null;

    return (next) => {
        if (exclude && exclude.indexOf(method) > -1) return next();
        if (include && include.indexOf(method) == -1) return next();

        callback(next);
    };
};