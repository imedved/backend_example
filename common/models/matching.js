'use strict';

let async = require('async');
let contextManager = require('../hooks').contextManager;
let matchingEndpoint = require('../custom_endpoints').matching;

module.exports = (Matching) => {

    let modelSchema = matchingEndpoint.getModelSchema();

    Matching.getMatchedUsersCount = matchingEndpoint.getMatchedUsersCount.bind(matchingEndpoint);
    Matching.remoteMethod('getMatchedUsersCount',
        {
            description: 'Count instances of the model matched by where from the data source.',
            http: { path: '/count', verb: 'get' },
            returns: {
                arg: 'data',
                root: true,
                type: 'object',
                default: { count: 0 }
            }
        }
    );

    Matching.getMatchedUsers = matchingEndpoint.getMatchedUsers.bind(matchingEndpoint);
    Matching.remoteMethod('getMatchedUsers',
        {
            description: 'Find all instances of the model matched by filter from the data source.',
            accepts: { arg: 'cursor', type: 'string', required: false },
            http: { path: '/find', verb: 'get' },
            returns: {
                arg: 'data',
                root: true,
                type: 'object',
                default: { next: 'string', previous: 'string', result: [modelSchema] }
            }
        }
    );

    Matching.beforeRemote('**', (context, unused, next) => {
        let hooks = [
            contextManager.verifyToken(context),
            contextManager.defineCurrentUser(context)
        ];
        async.series(hooks, next);
    });

    disableRemoteMethods(Matching);
};

/**
 * @param {*} Matching
 */
function disableRemoteMethods(Matching) {
    Matching.disableRemoteMethod('createChangeStream', true);
    Matching.disableRemoteMethod('updateAll', true);
    Matching.disableRemoteMethod('upsert', true);
    Matching.disableRemoteMethod('create', true);
    Matching.disableRemoteMethod('findOne', true);
    Matching.disableRemoteMethod('findById', true);
    Matching.disableRemoteMethod('deleteById', true);
    Matching.disableRemoteMethod('prototype.updateAttributes', true);
    Matching.disableRemoteMethod('count', true);
    Matching.disableRemoteMethod('exists', true);
    Matching.disableRemoteMethod('find', true);
}
