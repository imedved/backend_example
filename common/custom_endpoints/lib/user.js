'use strict';

const async = require('async');
const cps = require('continuate');
const InternalServerError = require('../../errors/internal_server_error');
const AuthError = require('../../errors/auth_error');
const BadRequestError = require('../../errors/bad_request_error');
const AppContext = require('./../../context');

class UserEndpoint extends AppContext {

    /**
     * @param {*} app
     * @param {FacebookRepository} facebookRepository
     * @param {Crypto} crypto
     * @param {*} logger
     * @param {{ accessTokenTtlType, accessTokenTtlValue }} config
     */
    constructor(app, facebookRepository, crypto, logger, config) {
        super(app, logger);
        this._FB = facebookRepository;
        this._crypto = crypto;
        this._config = {
            accessTokenTtlType: config.accessTokenTtlType,
            accessTokenTtlValue: config.accessTokenTtlValue
        };
    }

    /**
     * @param {*} callback
     * @private
     */
    _removeAllMy(callback) {
        let currentUserId = this.getCurrentUserId();
        if (!currentUserId) {
            return callback(new InternalServerError('Bad session. Current user id is null.'));
        }

        let User = this.getModel('user');
        let Relation = this.getModel('relation');

        async.auto({
            user: callback => User.destroyById(currentUserId, callback),
            relations: callback => {
                Relation.update({ subjectId: currentUserId }, { userExists: false, active: false }, callback);
            }
        }, callback);
    }

    /**
     * @param {function} callback
     */
    removeUserData(callback) {
        let fnName = 'removeUserData';

        async.auto({
            user: callback => this._removeAllMy(callback),
            apartment: callback => this.getModel('apartment').removeAllMy(callback),
            chats: callback => this.getModel('chat').removeAllMy(callback),
            comments: callback => this.getModel('comment').removeAllMy(callback),
            images: callback => this.getModel('image').removeAllMy(callback),
            location: callback => this.getModel('location').removeAllMy(callback),
            messages: callback => this.getModel('message').removeAllMy(callback),
            newsfeed: callback => this.getModel('newsfeed').removeAllMy(callback),
            relations: callback => this.getModel('relation').removeAllMy(callback),
            setting: callback => this.getModel('setting').removeAllMy(callback)
        }, (err, results) => {
            if (err) {
                this.logWarn(fnName, err);
                return callback(err);
            }
            let data = {
                user: results.user.user.count,
                apartment: results.apartment.count,
                chats: results.chats.count,
                comments: results.comments.count,
                images: results.images.count,
                location: results.location.count,
                messages: results.messages.count,
                newsfeed: results.newsfeed.count,
                relations: results.relations.count,
                setting: results.setting.count
            };
            this.logSuccess(fnName, data);
            callback(null, data);
        });
    }

    /**
     * @param {*} data
     * @param {function} callback
     * @param {function} originalMethod
     */
    createUser(data, callback, originalMethod) {
        let fnName = 'createUser';
        async.auto({
            user: callback => {
                data.created = new Date();
                originalMethod(data, callback);
            },
            relations: ['user', (results, callback) => {
                let Relation = this.getModel('relation');
                Relation.updateOrCreateAll(true, (err, result) => {
                    if (err) {
                        return callback(null, { error: err });
                    }
                    callback(null, result);
                });
            }],
            rollback: ['user', 'relations', (results, callback) => {
                if (!results.relations.error) {
                    return callback(null);
                }
                results.user.destroy(callback);
            }]
        }, (err, results) => {
            let error = err || results.relations.error;
            if (error) {
                this.logWarn(fnName, err);
                return callback(error);
            }
            let data = results.user;
            data.relation = results.relations;
            this.logSuccess(fnName, data);
            callback(null, data);
        });
    }

    /**
     * @param {string} fbTokenValue
     * @param {function} callback
     */
    login(fbTokenValue, callback) {
        let fnName = 'login';
        let Token = this.getModel('token');
        let User = this.getModel('user');

        async.auto({
            facebookProfile: (callback) => {
                this._FB.getProfile('me', { access_token: fbTokenValue }, callback);
            },
            facebookToken: (callback) => {
                this._getFbToken(fbTokenValue, callback);
            },
            refreshToken: ['facebookToken', 'facebookProfile', (results, callback) => {
                var id = results.facebookProfile.id;
                var timestamp = results.facebookToken.expiresAt;
                var refreshToken = this._crypto.encodeTokenByTimestamp(id, timestamp);
                callback(null, refreshToken);
            }],
            accessToken: ['facebookProfile', (results, callback) => {
                let id = results.facebookProfile.id;
                let ttlValue = this._config.accessTokenTtlValue;
                let ttlType = this._config.accessTokenTtlType;
                let accessToken = this._crypto.encodeTokenFromPeriod(id, ttlValue, ttlType);
                callback(null, accessToken);
            }],
            user: ['facebookProfile', (results, callback) => {
                User.findById(results.facebookProfile.id, callback);
            }],
            update: ['facebookProfile', 'accessToken', 'refreshToken', 'facebookToken', (results, callback) => {
                var userId = results.facebookProfile.id;
                var tokens = {
                    userId: userId,
                    role: 'USER',
                    facebookToken: results.facebookToken,
                    refreshToken: results.refreshToken,
                    accessToken: results.accessToken
                };
                Token.upsert(tokens, callback);
            }]
        }, (err, results) => {
            if (err) {
                this.logWarn(fnName, err);
                return callback(new AuthError(err.message));
            }
            var data = {
                userId: results.facebookProfile.id,
                userExists: !!results.user,
                refreshToken: results.refreshToken,
                accessToken: results.accessToken
            };
            this.logSuccess(fnName, data);
            callback(null, data);
        });
    }

    /**
     * @param {function} callback
     */
    logout(callback) {
        let fnName = 'logout';
        let tokens = this.getContext().get('tokens');

        let Token = this.getModel('token');
        Token.remove({ 'accessToken.value': tokens.accessToken.value }, (err, results) => {
            if (err) {
                this.logWarn(fnName, err);
                return callback(new AuthError(err.message));
            }
            let data = { success: results.count == 1 };
            this.logSuccess(fnName, data);
            callback(null, data);
        });
    }

    /**
     * @param {string} token
     * @param {function} callback
     */
    tokenExchange(token, callback) {
        let fnName = 'tokenExchange';
        let Token = this.getModel('token');
        let accessTokenTtlValue = this._config.accessTokenTtlValue;
        let accessTokenTtlType = this._config.accessTokenTtlType;

        async.auto({
            decodedToken: (callback) => {
                this._decodeUserToken(token, callback);
            },
            tokens: (callback) => {
                Token.find({ where: { 'refreshToken.value': token } }, (err, results) => {
                    callback(err, results.length ? results[0] : null);
                });
            },
            isVerified: ['tokens', 'decodedToken', (results, callback) => {
                let tokens = results.tokens;
                let decodedToken = results.decodedToken;

                if (!tokens || tokens.refreshToken.value !== token) {
                    return callback(new AuthError('Token not found.'));
                }
                if (!this._crypto.isTokenValid(decodedToken)) {
                    return callback(new AuthError('Token expired.'));
                }
                callback(null, true);
            }],
            accessToken: ['decodedToken', (results, callback) => {
                let userId = results.decodedToken.userId;
                let accessToken = this._crypto.encodeTokenFromPeriod(userId, accessTokenTtlValue, accessTokenTtlType);
                callback(null, accessToken);
            }],
            update: ['isVerified', 'tokens', 'accessToken', (results, callback) => {
                let tokens = results.tokens;
                tokens.accessToken = results.accessToken;
                Token.upsert(tokens, callback);
            }]
        }, (err, results) => {
            if (err) {
                this.logWarn(fnName, err);
                return callback(new AuthError(err.message));
            }
            let data = results.accessToken;
            this.logSuccess(fnName, data);
            callback(null, data);
        });
    }

    /**
     * @param {function} callback
     */
    facebookProfile(callback) {
        let fnName = 'facebookProfile';
        let tokens = this.getContext().get('tokens');

        let params = {
            access_token: tokens.facebookToken.value,
            fields: 'id,about,bio,birthday,email,picture.type(large),first_name,gender,locale,last_name,middle_name,name'
        };
        this._FB.getProfile(tokens.userId, params, (err, results) => {
            if (err) {
                this.logWarn(fnName, err);
                return callback(err);
            }
            this.logSuccess(fnName, results);
            callback(null, results);
        });
    }

    /**
     * @param {string} next
     * @param {string} previous
     * @param {function} callback
     */
    facebookAlbums(next, previous, callback) {
        let fnName = 'facebookAlbums';
        let tokens = this.getContext().get('tokens');
        let fbToken = tokens.facebookToken.value;

        async.auto({
            pagination: (callback) => {
                cps(this._createPaginationQuery)(next, previous, callback);
            },
            facebookAlbums: ['pagination', (results, callback) => {
                let paging = results.pagination;
                this._FB.getAlbums('me', paging, fbToken, callback);
            }]
        }, (err, results) => {
            if (err) {
                this.logWarn(fnName, err);
                return callback(err);
            }
            let data = results.facebookAlbums;
            this.logSuccess(fnName, data);
            callback(null, data);
        });
    }

    /**
     * @param {string} id
     * @param {string} next
     * @param {string} previous
     * @param {function} callback
     */
    facebookAlbumPhotos(id, next, previous, callback) {
        let fnName = 'facebookAlbumPhotos';
        let tokens = this.getContext().get('tokens');
        let fbToken = tokens.facebookToken.value;

        async.auto({
            pagination: (callback) => {
                cps(this._createPaginationQuery)(next, previous, callback);
            },
            facebookAlbumPhotos: ['pagination', (results, callback) => {
                var paging = results.pagination;
                this._FB.getAlbumPhotos(id, paging, fbToken, callback);
            }]
        }, (err, results) => {
            if (err) {
                this._logger.warn(`${fnName}, error: ${JSON.stringify(err)}`);
                return callback(err);
            }
            let data = results.facebookAlbumPhotos;
            this._logger.debug(`${fnName}, success: ${JSON.stringify(data)}`);
            callback(null, data);
        });
    }

    /**
     * @param {string} fbTokenValue
     * @param {function} callback
     * @private
     */
    _getFbToken(fbTokenValue, callback) {
        this._FB.debugToken(fbTokenValue, (err, response) => {
            if (err) {
                return callback(err);
            }
            var timestamp = response.data.expires_at;
            callback(null, this._crypto.createTokenObject(fbTokenValue, timestamp));
        });
    }

    /**
     * @param {string} token
     * @param {function} callback
     * @returns {*}
     * @private
     */
    _decodeUserToken(token, callback) {
        var decodedToken = this._crypto.decodeToken(token);
        if (!decodedToken || !decodedToken.userId) {
            return callback(new AuthError('Invalid access token.'));
        }
        callback(null, decodedToken);
    }

    /**
     * @param {string} next
     * @param {string} previous
     * @returns {*}
     * @private
     */
    _createPaginationQuery(next, previous) {
        if (next && previous) {
            throw new BadRequestError('Next and Previous paging in one request.');
        }
        if (previous) {
            return `&before=${previous}`;
        }
        if (next) {
            return `&after=${next}`;
        }
        return '';
    }
}

module.exports = UserEndpoint;