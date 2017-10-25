'use strict';

const async = require('async');
const BadRequestError = require('../../errors/bad_request_error');
const AppContext = require('./../../context');

const FACEBOOK_DEFAULT_LIMIT = 100;

class FriendEndpoint extends AppContext {

    /**
     * @param {*} app
     * @param {FacebookRepository} facebookRepository
     * @param {*} caseConverter
     * @param {*} logger
     */
    constructor(app, facebookRepository, caseConverter, logger) {
        super(app, logger);

        this._facebookRepository = facebookRepository;
        this._caseConverter = caseConverter;
    }

    /**
     * @param {{ limit: number, offset: number, fields: * }=} filter
     * @param {function} callback
     */
    getAllFriends(filter, callback) {
        let fnName = 'getAllFriends';
        let tokens = this.getContext().get('tokens');
        let fbToken = tokens.facebookToken.value;
        let currentUserId = this.getCurrentUserId();

        filter = filter || {};

        let isIncludeMutualFriends = filter.include == 'mutual_friends';
        let fields = this._formatFieldsToSnakeCase(filter.fields) || ['id', 'first_name', 'last_name', 'picture'];
        let offset = filter.offset || 0;
        let limit = filter.limit || FACEBOOK_DEFAULT_LIMIT;

        async.auto({
            friends: (callback) => {
                let params = { accessToken: fbToken, limit: limit, offset: offset, fields: fields };
                this._facebookRepository.getFriendsRecursive(currentUserId, params, {}, callback);
            },
            mutualFriends: ['friends', (results, callback) => {
                if (!isIncludeMutualFriends) {
                    return callback(null, []);
                }
                let friends = results.friends || [];
                let ids = friends.map(user => user.id);
                let params = { accessToken: fbToken, limit: FACEBOOK_DEFAULT_LIMIT, offset: 0, fields: fields };
                this._facebookRepository.getMutualFriendsBulk(ids, params, callback);
            }],
            formattedResult: ['friends', 'mutualFriends', (results, callback) => {
                if (!isIncludeMutualFriends) {
                    return callback(null, results.friends);
                }
                let friends = results.friends.map(user => {
                    user.mutual_friends = results.mutualFriends.filter(friend => friend.friend_id === user.id);
                    return user;
                });
                callback(null, friends);
            }]
        }, (err, results) => {
            if (err) {
                this.logWarn(fnName, err);
                return callback(err);
            }
            let data = (results.formattedResult || []).map(facebookUser => this._formatObjectToCamelCase(facebookUser));
            this.logSuccess(fnName, data);
            callback(null, data);
        });
    }

    /**
     * @param {string} userId
     * @param {{ limit: number, offset: number, fields: * }=} filter
     * @param {function} callback
     */
    getMutualFriends(userId, filter, callback) {
        let fnName = 'getMutualFriends';
        let tokens = this.getContext().get('tokens');

        filter = filter || {};
        let params = {
            accessToken: tokens.facebookToken.value,
            limit: filter.limit || 100,
            offset: filter.offset || 0,
            fields: this._formatFieldsToSnakeCase(filter.fields) || ['id', 'first_name', 'last_name', 'picture']
        };
        this._facebookRepository.getMutualFriends(userId, params, (err, results) => {
            if (err) {
                this.logWarn(fnName, err);
                return callback(err);
            }
            let data = (results || []).map(facebookUser => this._formatObjectToCamelCase(facebookUser));
            this.logSuccess(fnName, data);
            callback(null, data);
        });
    }

    /**
     * @param {*} body
     * @param {*} filter
     * @param {function} callback
     * @returns {*}
     */
    getMutualFriendsBulk(body, filter, callback) {
        let fnName = 'getMutualFriendsBulk';
        let tokens = this.getContext().get('tokens');

        let data = body.bulk;
        if (!data) {
            let err = new BadRequestError('Bulk must be defined.');
            this.logWarn(fnName, err);
            return callback(err);
        }
        if (!(data instanceof Array)) {
            let err = new BadRequestError('Bulk must be array of String.');
            this.logWarn(fnName, err);
            return callback(err);
        }

        filter = filter || {};
        let params = {
            accessToken: tokens.facebookToken.value,
            limit: filter.limit || 100,
            offset: filter.offset || 0,
            fields: this._formatFieldsToSnakeCase(filter.fields) || ['id', 'first_name', 'last_name', 'picture']
        };
        this._facebookRepository.getMutualFriendsBulk(data, params, (err, results) => {
            if (err) {
                this.logWarn(fnName, err);
                return callback(err);
            }
            let data = (results || []).map(facebookUser => this._formatObjectToCamelCase(facebookUser));
            this.logSuccess(fnName, data);
            callback(null, data);
        });
    }

    /**
     * @param {*} obj
     * @returns {*}
     * @private
     */
    _formatObjectToCamelCase(obj) {
        return this._caseConverter.convertObjectCase(obj, this._caseConverter.snakeToCamelCase);
    }

    /**
     * @param {Array} fields
     * @private
     */
    _formatFieldsToSnakeCase(fields) {
        if (!fields) return fields;
        if (typeof fields === 'string') fields = [fields];

        return fields.map(field => this._caseConverter.camelCaseToSnake(field));
    }
}

module.exports = FriendEndpoint;