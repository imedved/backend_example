'use strict';

let async = require('async');
let contextManager = require('../hooks').contextManager;
let injector = require('../hooks').injector;
let newsfeedGenerator = require("../hooks").newsfeedGenerator;
let apartmentEndpoint = require('../custom_endpoints').apartment;

module.exports = (Apartment) => {

    Apartment.removeAllMy = apartmentEndpoint.removeAllMy.bind(apartmentEndpoint);
    Apartment.remoteMethod('removeAllMy',
        {
            description: 'Delete a model instance by UserId from the data source.',
            http: { path: '/my', verb: 'delete' },
            returns: { type: 'object', root: true, default: { count: 0 } }
        }
    );

    Apartment.beforeRemote('**', (context, unused, next) => {
        let hooks = [
            contextManager.verifyToken(context),
            contextManager.verifyPermissions(context, {
                userIdFields: ['userId'],
                include: ['apartment.prototype.updateAttributes', 'apartment.deleteById']
            }),
            injector.removeFields(context, {
                fields: ['id', 'userId', 'created', 'modified'],
                include: ['apartment.create', 'apartment.prototype.updateAttributes']
            }),
            injector.addUserId(context, { injectField: 'userId', include: ['apartment.create', 'apartment.prototype.updateAttributes'] }),
            injector.addTimestampOnCreate(context, { include: ['apartment.create'] }),
            injector.addTimestampOnUpdate(context, { include: ['apartment.prototype.updateAttributes'] })
        ];
        async.series(hooks, next);
    });

    Apartment.afterRemote('create', newsfeedGenerator.onApartmentCreate.bind(newsfeedGenerator));

    disableRemoteMethods(Apartment);
};

/**
 * @param {*} Apartment
 */
function disableRemoteMethods(Apartment) {
    Apartment.disableRemoteMethod('createChangeStream', true);
    Apartment.disableRemoteMethod('updateAll', true);
    Apartment.disableRemoteMethod('upsert', true);

    Apartment.disableRemoteMethod('__create__images', false);
    Apartment.disableRemoteMethod('__delete__images', false);
    Apartment.disableRemoteMethod('__destroyById__images', false);
    Apartment.disableRemoteMethod('__updateById__images', false);

    Apartment.disableRemoteMethod('__create__location', false);
    Apartment.disableRemoteMethod('__delete__location', false);
    Apartment.disableRemoteMethod('__destroy__location', false);
    Apartment.disableRemoteMethod('__update__location', false);
}
