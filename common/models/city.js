'use strict';

let async = require('async');
let contextManager = require('../hooks').contextManager;
let injector = require('../hooks').injector;

module.exports = (City) => {

    City.beforeRemote('**', (context, unused, next) => {
        let hooks = [
            contextManager.verifyToken(context),
            injector.removeFields(context, {
                fields: ['id', 'created', 'modified'],
                include: ['city.create', 'city.prototype.updateAttributes']
            }),
            injector.addTimestampOnCreate(context, { include: ['city.create'] }),
            injector.addTimestampOnUpdate(context, { include: ['city.prototype.updateAttributes'] })
        ];
        async.series(hooks, next);
    });

    disableRemoteMethods(City);
};

/**
 * @param {*} City
 */
function disableRemoteMethods(City) {
    City.disableRemoteMethod('create', true);
    City.disableRemoteMethod('upsert', true);
    City.disableRemoteMethod('deleteById', true);
    City.disableRemoteMethod('updateAttributes', false);
    City.disableRemoteMethod('createChangeStream', true);
    City.disableRemoteMethod('updateAll', true);
    
    City.disableRemoteMethod('__create__users', false);
    City.disableRemoteMethod('__delete__users', false);
    City.disableRemoteMethod('__destroyById__users', false);
    City.disableRemoteMethod('__updateById__users', false);
}
