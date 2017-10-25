'use strict';

let async = require('async');
let contextManager = require('../hooks').contextManager;
let injector = require('../hooks').injector;
let settingEndpoint = require('../custom_endpoints').setting;

module.exports = (Setting) => {

    Setting.removeAllMy = settingEndpoint.removeAllMy.bind(settingEndpoint);
    Setting.remoteMethod('removeAllMy',
        {
            description: 'Delete a model instances by UserId from the data source.',
            http: { path: '/my', verb: 'delete' },
            returns: { root: true, type: 'object', default: { count: 0 } }
        }
    );

    Setting.beforeRemote('**', (context, unused, next) => {
        let hooks = [
            contextManager.verifyToken(context),
            contextManager.verifyPermissions(context, {
                userIdFields: ['userId'],
                include: ['setting.prototype.updateAttributes', 'setting.deleteById']
            }),
            injector.removeFields(context, {
                fields: ['id', 'userId', 'created', 'modified'],
                include: ['setting.create', 'setting.prototype.updateAttributes']
            }),
            injector.addUserId(context, { injectField: 'userId', include: ['setting.create', 'setting.prototype.updateAttributes'] }),
            injector.addTimestampOnCreate(context, { include: ['setting.create'] }),
            injector.addTimestampOnUpdate(context, { include: ['setting.prototype.updateAttributes'] })
        ];
        async.series(hooks, next);
    });

    disableRemoteMethods(Setting);
};

/**
 * @param {*} Setting
 */
function disableRemoteMethods(Setting) {
    Setting.disableRemoteMethod('createChangeStream', true);
    Setting.disableRemoteMethod('updateAll', true);
    Setting.disableRemoteMethod('upsert', true);
}
