'use strict';

let async = require('async');
let contextManager = require('../hooks').contextManager;
let injector = require('../hooks').injector;
let commentEndpoint = require('../custom_endpoints').comment;

module.exports = (Comment) => {

    Comment.removeAllMy = commentEndpoint.removeAllMy.bind(commentEndpoint);
    Comment.remoteMethod('removeAllMy',
        {
            description: 'Delete a model instance by UserId from the data source.',
            http: { path: '/my', verb: 'delete' },
            returns: { type: 'object', root: true, default: { count: 0 } }
        }
    );

    Comment.beforeRemote('**', (context, unused, next) => {
        let hooks = [
            contextManager.verifyToken(context),
            contextManager.verifyPermissions(context, {
                userIdFields: ['userId'],
                include: ['comment.deleteById']
            }),
            injector.removeFields(context, {
                fields: ['id', 'userId', 'created', 'modified'],
                include: ['comment.create', 'comment.prototype.updateAttributes']
            }),
            injector.addUserId(context, { injectField: 'userId', include: ['comment.create', 'comment.prototype.updateAttributes'] }),
            injector.addTimestampOnCreate(context, { include: ['comment.create'] }),
            injector.addTimestampOnUpdate(context, { include: ['comment.prototype.updateAttributes'] })
        ];
        async.series(hooks, next);
    });

    disableRemoteMethods(Comment);
};
/**
 * @param {*} Comment
 */
function disableRemoteMethods(Comment) {
    Comment.disableRemoteMethod('updateAttributes', false);
    Comment.disableRemoteMethod('createChangeStream', true);
    Comment.disableRemoteMethod('updateAll', true);
    Comment.disableRemoteMethod('upsert', true);
}