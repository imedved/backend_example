'use strict';

let async = require('async');
let contextManager = require('../hooks').contextManager;
let friendEndpoint = require('../custom_endpoints').friend;

module.exports = (Friend) => {

    let modelSchema = {
        id: 'string',
        firstName: 'string',
        lastName: 'string',
        picture: {
            data: {
                isSilhouette: true,
                url: 'string'
            }
        }
    };

    Friend.getAllFriends = friendEndpoint.getAllFriends.bind(friendEndpoint);

    Friend.getMutualFriends = friendEndpoint.getMutualFriends.bind(friendEndpoint);
    Friend.remoteMethod('getMutualFriends',
        {
            description: 'Find all instances of the model matched by filter from the data source.',
            accepts: [
                {
                    arg: 'id',
                    type: 'string',
                    description: 'Model id',
                    required: true
                },
                {
                    arg: 'filter',
                    type: 'object',
                    description: 'Filter defining fields, where, include, order, offset, and limit',
                    required: false
                }
            ],
            http: { path: '/mutual', verb: 'get' },
            returns: { arg: 'data', type: 'object', default: [modelSchema], root: true }
        }
    );

    Friend.getMutualFriendsBulk = friendEndpoint.getMutualFriendsBulk.bind(friendEndpoint);
    Friend.remoteMethod('getMutualFriendsBulk',
        {
            description: 'Find all instances of the model matched by filter from the data source.',
            accepts: [
                {
                    arg: 'data',
                    type: '{ "bulk": ["userId"] }',
                    http: { source: 'body' },
                    required: true
                },
                {
                    arg: 'filter',
                    type: 'object',
                    http: { source: 'query' },
                    description: 'Filter defining fields, where, include, order, offset, and limit',
                    required: false
                }
            ],
            http: { path: '/mutualBulk', verb: 'post' },
            returns: { arg: 'data', type: 'object', default: [modelSchema], root: true }
        }
    );

    Friend.beforeRemote('**', (context, unused, next) => {
        let hooks = [
            contextManager.verifyToken(context)
        ];
        async.series(hooks, next);
    });

    disableRemoteMethods(Friend);
};

/**
 * @param {*} Friend
 */
function disableRemoteMethods(Friend) {
    Friend.disableRemoteMethod('createChangeStream', true);
    Friend.disableRemoteMethod('find', true);
    Friend.disableRemoteMethod('updateAll', true);
    Friend.disableRemoteMethod('upsert', true);
    Friend.disableRemoteMethod('create', true);
    Friend.disableRemoteMethod('findOne', true);
    Friend.disableRemoteMethod('findById', true);
    Friend.disableRemoteMethod('deleteById', true);
    Friend.disableRemoteMethod('prototype.updateAttributes', true);
    Friend.disableRemoteMethod('count', true);
    Friend.disableRemoteMethod('exists', true);
}
