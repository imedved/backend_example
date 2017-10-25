'use strict';

let async = require('async');
let contextManager = require('../hooks').contextManager;
let tokenEndpoint = require('../custom_endpoints').token;

module.exports = function (Token) {

    Token.removeAllMy = tokenEndpoint.removeAllMy.bind(tokenEndpoint);
    Token.remoteMethod('removeAllMy',
        {
            description: 'Delete a model instances by UserId from the data source.',
            http: { path: '/my', verb: 'delete' },
            returns: { root: true, type: 'object', default: { count: 0 } }
        }
    );

    Token.debug = tokenEndpoint.debug.bind(tokenEndpoint);
    Token.remoteMethod('debug',
        {
            http: { path: '/debug', verb: 'post' },
            returns: {
                arg: 'data',
                root: true,
                type: 'object',
                default: {
                    id: 'string',
                    userId: 'string',
                    role: 'string',
                    accessToken: { value: 'string', expiresAt: 1465561229 },
                    facebookToken: { value: 'string', expiresAt: 1465563600 },
                    refreshToken: { value: 'string', expiresAt: 1465563600 }
                }
            }
        }
    );

    Token.beforeRemote('**', (context, unused, next) => {
        let hooks = [
            contextManager.verifyToken(context)
        ];
        async.series(hooks, next);
    });

    disableRemoteMethods(Token);
};

/**
 * @param {*} Token
 */
function disableRemoteMethods(Token) {
    Token.disableRemoteMethod('createChangeStream', true);
    Token.disableRemoteMethod('updateAll', true);
    Token.disableRemoteMethod('upsert', true);
    Token.disableRemoteMethod('create', true);
    Token.disableRemoteMethod('findOne', true);
    Token.disableRemoteMethod('findById', true);
    Token.disableRemoteMethod('deleteById', true);
    Token.disableRemoteMethod('prototype.updateAttributes', true);
    Token.disableRemoteMethod('count', true);
    Token.disableRemoteMethod('exists', true);
    Token.disableRemoteMethod('find', true);
}
