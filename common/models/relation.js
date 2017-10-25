'use strict';

let async = require('async');
let contextManager = require('../hooks').contextManager;
let newsfeedGenerator = require('../hooks').newsfeedGenerator;
let relationEndpoint = require('../custom_endpoints').relation;

module.exports = (Relation) => {

    Relation.generateId = relationEndpoint.generateId.bind(relationEndpoint);
    Relation.bulkCreate = relationEndpoint.bulkCreate.bind(relationEndpoint);

    Relation.removeAllMy = relationEndpoint.removeAllMy.bind(relationEndpoint);
    Relation.remoteMethod('removeAllMy',
        {
            description: 'Delete a model instances by UserId from the data source.',
            http: { path: '/my', verb: 'delete' },
            returns: { root: true, type: 'object', default: { count: 0 } }
        }
    );

    Relation.getAllMy = relationEndpoint.getAllMy.bind(relationEndpoint);
    Relation.remoteMethod('getAllMy',
        {
            description: 'Find all instances of the model matched by filter from the data source.',
            accepts: {
                arg: 'filter',
                type: 'object',
                required: false
            },
            http: { path: '/my', verb: 'get' },
            returns: { root: true, type: ['relation'] }
        }
    );

    Relation.customUpsert = relationEndpoint.customUpsert.bind(relationEndpoint);
    Relation.remoteMethod('customUpsert',
        {
            description: 'Update an existing model instance or insert a new one into the data source.',
            accepts: {
                arg: 'data',
                type: 'object',
                http: { source: 'body' },
                required: true
            },
            http: { path: '/', verb: 'put' },
            returns: { root: true, type: 'relation' }
        }
    );

    Relation.updateOrCreateAll = relationEndpoint.updateOrCreateAll.bind(relationEndpoint);
    Relation.remoteMethod('updateOrCreateAll',
        {
            accepts: { arg: 'force', type: 'boolean', required: false },
            http: { path: '/updateOrCreateAll', verb: 'post' },
            returns: {
                arg: 'count',
                root: true,
                type: 'object',
                default: { created: 0, modified: 0, lastUpdateDate: "2016-01-01T00:00:00.000Z" }
            }
        }
    );

    Relation.beforeRemote('**', beforeRemote);
    Relation.afterRemote('customUpsert', newsfeedGenerator.onRelationUpdateOrCreate.bind(newsfeedGenerator));

    disableRemoteMethods(Relation);
};

/**
 * @param {*} Relation
 */
function disableRemoteMethods(Relation) {
    Relation.disableRemoteMethod('createChangeStream', true);
    Relation.disableRemoteMethod('updateAll', true);
    Relation.disableRemoteMethod('upsert', true);
    Relation.disableRemoteMethod('create', true);
    Relation.disableRemoteMethod('prototype.updateAttributes', true);
}

/**
 * @param {*} context
 * @param {*} unused
 * @param {function} next
 */
function beforeRemote(context, unused, next) {
    let hooks = [
        contextManager.verifyToken(context),
        contextManager.verifyPermissions(context, {
            userIdFields: ['objectId', 'subjectId'],
            include: ['relation.deleteById']
        })
    ];
    async.series(hooks, next);
}