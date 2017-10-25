'use strict';

/**
 * @param {string} str
 * @returns {*}
 * @private
 */
module.exports.snakeToCamelCase = (str) => {
    if (!str || typeof str !== 'string') return str;

    return str.replace(/(\_[a-z])/g, ($1) => $1.toUpperCase().replace('_', ''));
};

/**
 * @param {string} str
 * @returns {*}
 * @private
 */
module.exports.camelCaseToSnake = (str) => {
    if (!str || typeof str !== 'string') return str;

    return str.replace(/([A-Z])/g, ($1) => "_" + $1.toLowerCase());
};

/**
 * @param {*} obj
 * @param {function} converter
 * @returns {*}
 * @private
 */
function convertObjectCase(obj, converter) {
    if (!obj) return obj;

    let result = {};
    Object.keys(obj).forEach(key => {
        let value = obj[key];
        if (typeof value === 'object' && !(value instanceof Array)) {
            value = convertObjectCase(value, converter);
        }
        let camelKey = converter(key);
        result[camelKey] = value;
    });
    return result;
}

module.exports.convertObjectCase = convertObjectCase;
