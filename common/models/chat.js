'use strict';

let async = require('async');
let contextManager = require('../hooks').contextManager;
let injector = require('../hooks').injector;
let chatEndpoint = require('../custom_endpoints').chat;

module.exports = (Chat) => {

    Chat.removeAllMy = chatEndpoint.removeAllMy.bind(chatEndpoint);
    Chat.remoteMethod('removeAllMy',
        {
            description: 'Delete a model instance by UserId from the data source.',
            http: { path: '/my', verb: 'delete' },
            returns: { type: 'object', root: true, default: { count: 0 } }
        }
    );

    Chat.getMyChats = chatEndpoint.getMyChats.bind(chatEndpoint);
    Chat.remoteMethod('getMyChats',
        {
            description: 'Find all instances of the model matched by filter from the data source.',
            accepts: {
                arg: 'filter',
                type: 'object',
                description: 'Filter defining fields, where, include, order, offset, and limit',
                required: false
            },
            http: { path: '/my', verb: 'get' },
            returns: { type: [Chat.modelName], root: true }
        }
    );

    Chat.beforeRemote('**', (context, unused, next) => {
        let hooks = [
            contextManager.verifyToken(context),
            contextManager.verifyPermissions(context, {
                userIdFields: ['creatorId', 'opponentId'],
                include: ['chat.prototype.updateAttributes', 'chat.deleteById']
            }),
            injector.removeFields(context, {
                fields: ['id', 'creatorId', 'created', 'modified'],
                include: ['chat.create', 'chat.prototype.updateAttributes']
            }),
            injector.addUserId(context, { injectField: 'creatorId', include: ['chat.create', 'chat.prototype.updateAttributes'] }),
            injector.addTimestampOnCreate(context, { include: ['chat.create'] }),
            injector.addTimestampOnUpdate(context, { include: ['chat.prototype.updateAttributes'] })
        ];
        async.series(hooks, next);
    });

    disableRemoteMethods(Chat);
};

/**
 * @param {*} Chat
 */
function disableRemoteMethods(Chat) {
    Chat.disableRemoteMethod('createChangeStream', true);
    Chat.disableRemoteMethod('updateAll', true);
    Chat.disableRemoteMethod('upsert', true);

    Chat.disableRemoteMethod('__create__messages', false);
    Chat.disableRemoteMethod('__delete__messages', false);
    Chat.disableRemoteMethod('__destroyById__messages', false);
    Chat.disableRemoteMethod('__updateById__messages', false);

    Chat.disableRemoteMethod('__create__lastMessage', false);
    Chat.disableRemoteMethod('__destroy__lastMessage', false);
    Chat.disableRemoteMethod('__update__lastMessage', false);
}
