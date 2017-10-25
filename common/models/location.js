'use strict';

let async = require('async');
let contextManager = require('../hooks').contextManager;
let injector = require('../hooks').injector;
let locationEndpoint = require('../custom_endpoints').location;

module.exports = (Location) => {

    Location.once('attached', (/*obj*/) => {
        let create = Location.create.bind(Location);
        Location.create = locationEndpoint.customCreate.bind(locationEndpoint, create);
    });

    Location.removeAllMy = locationEndpoint.removeAllMy.bind(locationEndpoint);
    Location.remoteMethod('removeAllMy',
        {
            description: 'Delete a model instance by UserId from the data source.',
            http: { path: '/my', verb: 'delete' },
            returns: { type: 'object', root: true, default: { count: 0 } }
        }
    );

    Location.beforeRemote('**', (context, unused, next) => {
        let hooks = [
            contextManager.verifyToken(context),
            contextManager.verifyPermissions(context, {
                userIdFields: ['userId'],
                include: ['location.prototype.updateAttributes', 'location.deleteById']
            }),
            injector.removeFields(context, {
                fields: ['id', 'userId', 'created', 'modified'],
                include: ['location.create', 'location.prototype.updateAttributes']
            }),
            injector.addUserId(context, {
                injectField: 'userId',
                include: ['location.create', 'location.prototype.updateAttributes']
            }),
            injector.addTimestampOnCreate(context, { include: ['location.create'] }),
            injector.addTimestampOnUpdate(context, { include: ['location.prototype.updateAttributes'] })
        ];
        async.series(hooks, next);
    });

    disableRemoteMethods(Location);
};

/**
 * @param {*} Location
 */
function disableRemoteMethods(Location) {
    Location.disableRemoteMethod('createChangeStream', true);
    Location.disableRemoteMethod('updateAll', true);
    Location.disableRemoteMethod('upsert', true);
}
