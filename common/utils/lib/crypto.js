'use strict';

var jwt = require('jwt-simple'),
    crypto = require('crypto'),
    moment = require('moment');

class Crypto {

    /**
     * @param {{ authSecret, expirePeriod, periodType }=} options
     */
    constructor(options) {
        options = options || {};
        this._secret = options.authSecret || 'dev';
        this._period = options.expirePeriod || 60;
        this._periodType = options.periodType || 'days';
    }

    /**
     * @param {string} token
     * @returns {*}
     */
    decodeToken(token) {
        if (!token) return null;
        try {
            return jwt.decode(token, this._secret);
        } catch (e) {
            return null;
        }
    }

    /**
     * @param {{ expiresAt: number, value: string }} tokenObj
     * @returns {boolean}
     */
    isTokenValid(tokenObj) {
        if (!tokenObj) {
            return false;
        }

        if (new Date() >= new Date(tokenObj.expiresAt * 1000)) {
            return false;
        }

        return true;
    }

    /**
     * @param {string} token
     * @param {number} timestamp
     * @returns {{value: *, expiresAt: *}}
     */
    createTokenObject(token, timestamp) {
        return {
            value: token,
            expiresAt: timestamp
        };
    }

    /**
     * @param {string} userId
     * @param {number=} period
     * @param {string=} periodType
     * @returns {*}
     */
    encodeTokenFromPeriod(userId, period, periodType) {
        if (!userId || !userId.length) {
            return null;
        }

        period = period || this._period;
        periodType = periodType || this._periodType;

        var timestamp = moment().add(period, periodType).unix();
        var token = jwt.encode({
            _rnd: Date.now(),
            userId: userId,
            expiresAt: timestamp
        }, this._secret);
        return this.createTokenObject(token, timestamp);
    }

    /**
     * @param {string} userId
     * @param {number=} timestamp
     * @returns {*}
     */
    encodeTokenByTimestamp(userId, timestamp) {
        if (!userId || !userId.length) {
            return null;
        }

        timestamp = timestamp || 0;
        var token = jwt.encode({
            _rnd: Date.now(),
            userId: userId,
            expiresAt: timestamp
        }, this._secret);
        return this.createTokenObject(token, timestamp);
    }

    /**
     * @param {string} str
     */
    decodeData(str) {
        try {
            let data = new Buffer(str, 'base64').toString('binary');
            return JSON.parse(data);
        } catch (e) {
            return null;
        }
    }

    /**
     * @param {*} data
     */
    encodeData(data) {
        try {
            let buffer;
            if (data instanceof Buffer) {
                buffer = data;
            } else {
                data = typeof data === 'string' ? data : JSON.stringify(data);
                buffer = new Buffer(data.toString(), 'binary');
            }
            return buffer.toString('base64');
        } catch (e) {
            return null;
        }
    }
}

module.exports = Crypto;
