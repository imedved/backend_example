'use strict';

let async = require('async');
let contextManager = require('../hooks').contextManager;
let injector = require('../hooks').injector;
let messageEndpoint = require('../custom_endpoints').message;

module.exports = (Message) => {

    Message.removeAllMy = messageEndpoint.removeAllMy.bind(messageEndpoint);
    Message.remoteMethod('removeAllMy',
        {
            description: 'Delete a model instance by UserId from the data source.',
            http: { path: '/my', verb: 'delete' },
            returns: { type: 'object', root: true, default: { count: 0 } }
        }
    );

    Message.bulkUpdateRead = messageEndpoint.bulkUpdateRead.bind(messageEndpoint);
    Message.remoteMethod('bulkUpdateRead',
        {
            accepts: {
                arg: 'data',
                type: '{ "bulk": ["string"] }',
                http: { source: 'body' },
                required: true
            },
            http: { path: '/updateRead', verb: 'post' },
            returns: { arg: 'count', type: 'number' }
        }
    );

    Message.beforeRemote('**', (context, unused, next) => {
        let hooks = [
            contextManager.verifyToken(context),
            contextManager.verifyPermissions(context, {
                userIdFields: ['senderId', 'receiverId'],
                include: ['message.prototype.updateAttributes', 'message.deleteById']
            }),
            injector.removeFields(context, {
                fields: ['senderId', 'created', 'modified'],
                include: ['message.create', 'message.prototype.updateAttributes']
            }),
            injector.addUserId(context, { injectField: 'senderId', include: ['message.create', 'message.prototype.updateAttributes'] }),
            injector.addTimestampOnCreate(context, { include: ['message.create'] }),
            injector.addTimestampOnUpdate(context, { include: ['message.prototype.updateAttributes'] })
        ];
        async.series(hooks, next);
    });

    disableRemoteMethods(Message);
};

/**
 * @param {*} Message
 */
function disableRemoteMethods(Message) {
    Message.disableRemoteMethod('createChangeStream', true);
    Message.disableRemoteMethod('updateAll', true);
    Message.disableRemoteMethod('upsert', true);

    Message.disableRemoteMethod('__create__attachment', false);
    Message.disableRemoteMethod('__destroy__attachment', false);
    Message.disableRemoteMethod('__update__attachment', false);
}
