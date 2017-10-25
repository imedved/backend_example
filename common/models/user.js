'use strict';

let async = require('async');
let contextManager = require('../hooks').contextManager;
let injector = require('../hooks').injector;
let errorChecking = require('../hooks/lib/error_checking');
let newsfeedGenerator = require('../hooks').newsfeedGenerator;
let userEndpoint = require('../custom_endpoints').user;

module.exports = (User) => {

    User.once('attached', (/*obj*/) => {
        let originCreate = User.create.bind(User);
        User.create = (data, callback) => {
            userEndpoint.createUser(data, callback, originCreate);
        }
    });

    User.removeAllMy = userEndpoint.removeUserData.bind(userEndpoint);
    User.remoteMethod('removeAllMy',
        {
            description: 'Delete a model instances by UserId from the data source.',
            http: { path: '/my', verb: 'delete' },
            returns: {
                root: true, type: 'object',
                default: {
                    user: 0,
                    apartment: 0,
                    chats: 0,
                    comments: 0,
                    images: 0,
                    location: 0,
                    messages: 0,
                    newsfeed: 0,
                    relations: 0,
                    setting: 0
                }
            }
        }
    );

    User.login = userEndpoint.login.bind(userEndpoint);
    User.remoteMethod('login',
        {
            accepts: { arg: 'facebook_token', type: 'string', required: true },
            http: { path: '/login', verb: 'post' },
            returns: {
                arg: 'data',
                type: 'object',
                default: {
                    userId: 'string',
                    userExists: true,
                    refreshToken: { value: 'string', expiresAt: 1465488000 },
                    accessToken: { value: 'string', expiresAt: 1465487940 }
                }
            }
        }
    );

    User.logout = userEndpoint.logout.bind(userEndpoint);
    User.remoteMethod('logout',
        {
            http: { path: '/logout', verb: 'post' },
            returns: { arg: 'data', type: 'object', default: { success: true } }
        }
    );

    User.tokenExchange = userEndpoint.tokenExchange.bind(userEndpoint);
    User.remoteMethod('tokenExchange',
        {
            accepts: { arg: 'refresh_token', type: 'string', required: true },
            http: { path: '/token_exchange', verb: 'post' },
            returns: { arg: 'data', type: 'object', default: { value: 'string', expiresAt: 1465488187 } }
        }
    );

    User.facebookProfile = userEndpoint.facebookProfile.bind(userEndpoint);
    User.remoteMethod('facebookProfile',
        {
            http: { path: '/facebook_profile', verb: 'get' },
            returns: {
                arg: 'profile',
                type: 'object',
                default: {
                    id: 'string',
                    picture: { data: { is_silhouette: true, url: 'string' } },
                    first_name: 'string',
                    gender: 'string',
                    locale: 'string',
                    last_name: 'string',
                    middle_name: 'string',
                    name: 'string'
                }
            }
        }
    );

    User.facebookAlbums = userEndpoint.facebookAlbums.bind(userEndpoint);
    User.remoteMethod('facebookAlbums',
        {
            accepts: [
                { arg: 'next', type: 'string', required: false },
                { arg: 'previous', type: 'string', required: false }
            ],
            http: { path: '/facebook_albums', verb: 'get' },
            returns: {
                arg: 'albums',
                type: 'object',
                default: {
                    data: [
                        {
                            id: 'string',
                            name: 'string',
                            count: 0,
                            cover_photo: { source: 'string', id: 'string' },
                            type: 'string'
                        }
                    ]
                }
            }
        }
    );

    User.facebookAlbumPhotos = userEndpoint.facebookAlbumPhotos.bind(userEndpoint);
    User.remoteMethod('facebookAlbumPhotos',
        {
            accepts: [
                { arg: 'id', type: 'string', required: true },
                { arg: 'next', type: 'string', required: false },
                { arg: 'previous', type: 'string', required: false }
            ],
            http: { path: '/facebook_albums/:id/photos', verb: 'get' },
            returns: {
                arg: 'photos',
                type: 'object',
                default: {
                    data: [{
                        id: 'string',
                        images: [{
                            height: 0,
                            width: 0,
                            source: 'string'
                        }]
                    }]
                }
            }
        }
    );

    User.beforeRemote('**', (context, unused, next) => {
        let hooks = [
            contextManager.verifyToken(context, { exclude: ['user.login', 'user.tokenExchange'] }),
            contextManager.verifyPermissions(context, {
                userIdFields: ['id'],
                include: ['user.prototype.updateAttributes', 'user.deleteById']
            }),
            injector.removeFields(context, {
                fields: ['id', 'created', 'modified'],
                include: ['user.create', 'user.prototype.updateAttributes']
            }),
            injector.addUserId(context, { injectField: 'id', include: ['user.create', 'user.prototype.updateAttributes'] }),
            injector.addTimestampOnCreate(context, { include: ['user.create'] }),
            injector.addTimestampOnUpdate(context, { include: ['user.prototype.updateAttributes'] })
        ];
        async.series(hooks, next);
    });

    User.afterRemote('**', (context, unused, next) => {
        let hooks = [
            contextManager.cleanup(context, { include: ['user.logout', 'user.tokenExchange'] })
        ];
        async.series(hooks, next);
    });

    User.afterRemote('prototype.updateAttributes', newsfeedGenerator.onUserUpdate.bind(newsfeedGenerator));
    User.afterRemoteError('**', errorChecking.checkAuthError());

    disableRemoteMethods(User);
};

/**
 * @param {*} User
 */
function disableRemoteMethods(User) {
    User.disableRemoteMethod('createChangeStream', true);
    User.disableRemoteMethod('updateAll', true);
    User.disableRemoteMethod('upsert', true);

    User.disableRemoteMethod('__create__images', false);
    User.disableRemoteMethod('__delete__images', false);
    User.disableRemoteMethod('__destroyById__images', false);
    User.disableRemoteMethod('__updateById__images', false);

    User.disableRemoteMethod('__create__tags', false);
    User.disableRemoteMethod('__delete__tags', false);
    User.disableRemoteMethod('__destroyById__tags', false);
    User.disableRemoteMethod('__updateById__tags', false);

    User.disableRemoteMethod('__create__apartment', false);
    User.disableRemoteMethod('__delete__apartment', false);
    User.disableRemoteMethod('__destroy__apartment', false);
    User.disableRemoteMethod('__update__apartment', false);

    User.disableRemoteMethod('__create__avatar', false);
    User.disableRemoteMethod('__delete__avatar', false);
    User.disableRemoteMethod('__destroy__avatar', false);
    User.disableRemoteMethod('__update__avatar', false);

    User.disableRemoteMethod('__create__setting', false);
    User.disableRemoteMethod('__delete__setting', false);
    User.disableRemoteMethod('__destroy__setting', false);
    User.disableRemoteMethod('__update__setting', false);

    User.disableRemoteMethod('__create__location', false);
    User.disableRemoteMethod('__delete__location', false);
    User.disableRemoteMethod('__destroy__location', false);
    User.disableRemoteMethod('__update__location', false);

    User.disableRemoteMethod('__create__relations', false);
    User.disableRemoteMethod('__delete__relations', false);
    User.disableRemoteMethod('__destroyById__relations', false);
    User.disableRemoteMethod('__updateById__relations', false);

    User.disableRemoteMethod('__create__comments', false);
    User.disableRemoteMethod('__delete__comments', false);
    User.disableRemoteMethod('__destroyById__comments', false);
    User.disableRemoteMethod('__updateById__comments', false);

    User.disableRemoteMethod('__create__newsfeeds', false);
    User.disableRemoteMethod('__delete__newsfeeds', false);
    User.disableRemoteMethod('__destroyById__newsfeeds', false);
    User.disableRemoteMethod('__updateById__newsfeeds', false);

    User.disableRemoteMethod('__create__profileImages', false);
    User.disableRemoteMethod('__delete__profileImages', false);
    User.disableRemoteMethod('__destroyById__profileImages', false);
    User.disableRemoteMethod('__updateById__profileImages', false);
}