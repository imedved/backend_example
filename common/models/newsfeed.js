'use strict';

let async = require('async');
let contextManager = require('../hooks').contextManager;
let injector = require('../hooks').injector;
let newsfeedEndpoint = require('../custom_endpoints').newsfeed;

module.exports = (Newsfeed) => {

    Newsfeed.removeAllMy = newsfeedEndpoint.removeAllMy.bind(newsfeedEndpoint);
    Newsfeed.remoteMethod('removeAllMy',
        {
            description: 'Delete a model instance by UserId from the data source.',
            http: { path: '/my', verb: 'delete' },
            returns: { type: 'object', root: true, default: { count: 0 } }
        }
    );

    Newsfeed.customFind = newsfeedEndpoint.customFind.bind(newsfeedEndpoint);
    Newsfeed.remoteMethod('customFind',
        {
            description: 'Find all instances of the model matched by filter from the data source.',
            accepts: {
                arg: 'filter',
                type: 'object',
                description: 'Filter defining fields, where, include, order, offset, and limit',
                required: false
            },
            http: { path: '/', verb: 'get' },
            returns: { type: ['newsfeed'], root: true }
        }
    );

    Newsfeed.getPersonal = newsfeedEndpoint.getPersonal.bind(newsfeedEndpoint);
    Newsfeed.remoteMethod('getPersonal',
        {
            description: 'Find all instances of the model matched by filter from the data source.',
            accepts: {
                arg: 'filter',
                type: 'object',
                description: 'Filter defining fields, where, include, order, offset, and limit',
                required: false
            },
            http: { path: '/personal', verb: 'get' },
            returns: { type: ['newsfeed'], root: true }
        }
    );

    Newsfeed.createLike = newsfeedEndpoint.createLike.bind(newsfeedEndpoint);
    Newsfeed.remoteMethod('createLike',
        {
            description: 'Create a new instance of the model and persist it into the data source.',
            accepts: { arg: 'id', type: 'string', required: true },
            http: { path: '/:id/likes', verb: 'post' },
            returns: { type: 'object', root: true }
        }
    );

    Newsfeed.removeLike = newsfeedEndpoint.removeLike.bind(newsfeedEndpoint);
    Newsfeed.remoteMethod('removeLike',
        {
            description: 'Delete a model instances by UserId from the data source.',
            accepts: { arg: 'id', type: 'string', required: true },
            http: { path: '/:id/likes', verb: 'delete' },
            returns: { type: 'object', root: true }
        }
    );

    Newsfeed.likesCount = newsfeedEndpoint.getLikesCount.bind(newsfeedEndpoint);
    Newsfeed.remoteMethod('likesCount',
        {
            description: 'Count instances of the model matched by where from the data source.',
            accepts: { arg: 'id', type: 'string', required: true },
            http: { path: '/:id/likes/count', verb: 'get' },
            returns: { type: 'object', root: true }
        }
    );

    Newsfeed.beforeRemote('**', (context, unused, next) => {
        let hooks = [
            contextManager.verifyToken(context),
            contextManager.verifyPermissions(context, {
                userIdFields: ['creatorId'],
                include: ['newsfeed.deleteById']
            }),
            injector.removeFields(context, {
                fields: ['id', 'creatorId', 'created', 'modified'],
                include: ['newsfeed.create', 'newsfeed.prototype.updateAttributes']
            }),
            injector.addUserId(context, { injectField: 'creatorId', include: ['newsfeed.create', 'newsfeed.prototype.updateAttributes'] }),
            injector.addTimestampOnCreate(context, { include: ['newsfeed.create'] }),
            injector.addTimestampOnUpdate(context, { include: ['newsfeed.prototype.updateAttributes'] })
        ];
        async.series(hooks, next);
    });

    disableRemoteMethods(Newsfeed);
};

/**
 * @param {*} Newsfeed
 */
function disableRemoteMethods(Newsfeed) {
    Newsfeed.disableRemoteMethod('createChangeStream', true);
    Newsfeed.disableRemoteMethod('updateAll', true);
    Newsfeed.disableRemoteMethod('upsert', true);
    Newsfeed.disableRemoteMethod('updateAttributes', false);
    Newsfeed.disableRemoteMethod('find', true);

    Newsfeed.disableRemoteMethod('__create__comments', false);
    Newsfeed.disableRemoteMethod('__delete__comments', false);
    Newsfeed.disableRemoteMethod('__destroyById__comments', false);
    Newsfeed.disableRemoteMethod('__updateById__comments', false);

    Newsfeed.disableRemoteMethod('__create__images', false);
    Newsfeed.disableRemoteMethod('__delete__images', false);
    Newsfeed.disableRemoteMethod('__destroyById__images', false);
    Newsfeed.disableRemoteMethod('__updateById__images', false);
}