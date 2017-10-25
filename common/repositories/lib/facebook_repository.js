'use strict';

let FacebookError = require('./facebook_error');

const FACEBOOK_DEFAULT_QUERY_LIMIT = 100;

class FacebookRepository {

    /**
     * @param {*} fbClient
     * @param {*} crypto
     * @param {{ clientID, clientSecret, depth }} config
     */
    constructor(fbClient, crypto, config) {
        if (!config.clientID || !config.clientSecret) {
            throw new FacebookError('Bad clientID or clientSecret param.');
        }
        this._crypto = crypto;
        this._fbClient = fbClient;
        this._facebookAppId = config.clientID;
        this._facebookAppSecret = config.clientSecret;
        this._fbClient.setAccessToken(this._facebookAppId + '|' + this._facebookAppSecret);
        this._recursiveDepth = config.depth || 10;
    }

    /**
     * @param {string} token
     * @param {function} callback
     */
    debugToken(token, callback) {
        this._fbClient.api('debug_token', { input_token: token }, (response) => {
            if (response && response.error) {
                return callback(new FacebookError(response.error.message));
            }
            callback(null, response);
        });
    }

    /**
     * @param {string} userId
     * @param {*} query
     * @param {function} callback
     */
    getProfile(userId, query, callback) {
        this._fbClient.api('/' + userId, query, (response) => {
            if (response && response.error) {
                return callback(new FacebookError(response.error.message));
            }
            callback(null, response);
        });
    }

    /**
     * @param {string} userId
     * @param {{ accessToken: string, limit: number, offset: number }} query
     * @param {function} callback
     */
    getFriends(userId, query, callback) {
        this._fbClient.api('/' + userId + '/friends', query, (response) => {
            if (response && response.error) {
                return callback(new FacebookError(response.error.message));
            }
            callback(null, response);
        });
    }

    /**
     * @param {string} userId
     * @param {{ accessToken: string, limit: number, offset: number, depth: number }} query
     * @param {{ error, data, done }} summary
     * @param {function} callback
     * @returns {*}
     */
    getFriendsRecursive(userId, query, summary, callback) {
        query = query || {};
        query.limit = query.limit || FACEBOOK_DEFAULT_QUERY_LIMIT;
        query.offset = query.offset || 0;
        query.depth = query.depth || 0;

        summary = summary || {};
        summary.data = summary.data || [];
        summary.done = summary.done || false;

        if (summary.error) {
            return callback(new FacebookError(summary.error.message));
        }

        if (this._recursiveDepth === query.depth || summary.done) {
            return callback(null, summary.data);
        }

        this.getFriends(userId, query, (err, result) => {
            let data = result.data;

            if (err || !data.length || data.length < query.limit) {
                summary.error = err;
                summary.done = true;
            }

            summary.data = summary.data.concat(data);

            query.depth++;
            query.offset = query.offset + query.limit;

            this.getFriendsRecursive(userId, query, summary, callback);
        });
    }

    /**
     * @param {string} userId
     * @param {{ accessToken: string, limit: number }} query
     * @param {function} callback
     */
    getMutualFriends(userId, query, callback) {
        let limit = query.limit;
        let token = query.accessToken;
        let fields = query.fields;

        this._fbClient.api('/' + userId, {
            access_token: token,
            appsecret_proof: this._getAppProof(token),
            fields: 'context.fields(all_mutual_friends.limit(' + limit + ').fields(' + fields + '))'
        }, (response) => {
            if (response && response.error) {
                return callback(new FacebookError(response.error.message));
            }
            var result = this._mapMutualFriendResponse(response);
            callback(null, result);
        });
    }

    /**
     * @param {Array} ids
     * @param {{ accessToken: string, limit: number }} query
     * @param {function} callback
     */
    getMutualFriendsBulk(ids, query, callback) {
        let token = query.accessToken;
        let batch = ids.map(id => this._formMutualFriendContext(id, query));

        this._fbClient.api('', 'post', {
            batch: batch,
            access_token: token,
            appsecret_proof: this._getAppProof(token)
        }, (response) => {
            if (!response || response.error) {
                return callback(new FacebookError(response.error.message));
            }
            let result = response
                .filter(resp => resp.code === 200)
                .map(resp => tryParse(resp.body))
                .filter(data => data !== null)
                .reduce((memo, data) => memo.concat(this._mapMutualFriendResponse(data)), []);

            callback(null, result);
        });
    }

    /**
     * @param {string} userId
     * @param {string} paging
     * @param {string} token
     * @param {function} callback
     */
    getAlbums(userId, paging, token, callback) {
        var limit = 25;
        this._fbClient.api('/' + userId + '/albums?limit=' + limit + '&fields=id,name,count,cover_photo{source},type' + paging,
            { access_token: token }, (response) => {
                if (response && response.error) {
                    return callback(new FacebookError(response.error.message));
                }
                if (!response.data.length) {
                    return callback(null, response);
                }
                callback(null, replacePagination(response))
            });
    }

    /**
     * @param {string} albumId
     * @param {string} paging
     * @param {string} token
     * @param {function} callback
     */
    getAlbumPhotos(albumId, paging, token, callback) {
        var limit = 25;
        this._fbClient.api('/' + albumId + '/photos?limit=' + limit + '&fields=id,images' + paging, { access_token: token }, (response) => {
            if (response && response.error) {
                return callback(new FacebookError(response.error.message));
            }
            if (!response.data.length || !response) {
                return callback(null, response);
            }
            callback(null, replacePagination(response));
        });
    }

    /**
     * @param {string} userId
     * @param {{ accessToken: string, limit: number }} params
     * @returns {{method: string, relative_url: string}}
     * @private
     */
    _formMutualFriendContext(userId, params) {
        let limit = params.limit;
        let fields = params.fields;
        return {
            method: 'get',
            relative_url: '/' + userId + '?fields=context.fields(all_mutual_friends.limit(' + limit + ').fields(' + fields + '))',
        }
    }

    /**
     * @param response
     * @returns {Array}
     * @private
     */
    _mapMutualFriendResponse(response) {
        let targetId = response.id;
        let fbContext = response.context.all_mutual_friends;
        let data = (fbContext || {}).data || [];

        return data.map(user => {
            user.friend_id = targetId;
            return user;
        });
    }

    _getAppProof(token) {
        let hmac = this._crypto.createHmac('sha256', this._facebookAppSecret);
        hmac.update(token);
        return hmac.digest('hex');
    }
}

/**
 * @param {{ paging }} response
 * @returns {*}
 */
function replacePagination(response) {
    if (!response) return null;

    if (response.paging.next) {
        response.paging.next = response.paging.cursors.after;
    } else {
        response.paging.next = null;
    }

    if (response.paging.previous) {
        response.paging.previous = response.paging.cursors.before;
    } else {
        response.paging.previous = null;
    }

    delete response.paging.cursors;
    return response;
}

function tryParse(string) {
    try {
        return JSON.parse(string);
    } catch (e) {
        // logger
        return null;
    }
}

module.exports = FacebookRepository;

