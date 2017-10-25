'use strict';

let async = require('async');
let contextManager = require('../hooks').contextManager;
let fileManager = require('../hooks').fileManager;
let injector = require('../hooks').injector;
let imageEndpoint = require('../custom_endpoints').image;

module.exports = (Image) => {

    Image.removeAllMy = imageEndpoint.removeAllMy.bind(imageEndpoint);
    Image.remoteMethod('removeAllMy',
        {
            description: 'Delete a model instance by UserId from the data source.',
            http: { path: '/my', verb: 'delete' },
            returns: { type: 'object', root: true, default: { count: 0 } }
        }
    );

    Image.upload = imageEndpoint.upload.bind(imageEndpoint);
    Image.remoteMethod('upload',
        {
            accepts: [
                { arg: 'width', type: 'number', http: { source: 'query' }, required: true },
                { arg: 'height', type: 'number', http: { source: 'query' }, required: true },
                { arg: 'order', type: 'number', http: { source: 'query' }, required: true },
                { arg: 'avatarId', type: 'string', http: { source: 'query' }, required: false },
                { arg: 'apartmentId', type: 'string', http: { source: 'query' }, required: false },
                { arg: 'messageId', type: 'string', http: { source: 'query' }, required: false },
                { arg: 'newsfeedId', type: 'string', http: { source: 'query' }, required: false }
            ],
            http: { path: '/upload', verb: 'post' },
            returns: { arg: 'data', type: Image.modelName }
        }
    );

    Image.once('attached', (/*obj*/) => {
        Image.deleteById = fileManager.deleteById(Image);
    });

    Image.beforeRemote('**', (context, unused, next) => {
        let hooks = [
            contextManager.verifyToken(context),
            contextManager.verifyPermissions(context, {
                userIdFields: ['userId'],
                include: ['image.deleteById']
            }),
            fileManager.parseImage(context, { include: ['image.upload'] }),
            injector.removeFields(context, {
                fields: ['id', 'userId', 'created', 'modified'],
                include: ['image.prototype.updateAttributes']
            }),
            injector.addUserId(context, { injectField: 'userId', include: ['image.prototype.updateAttributes'] }),
            injector.addTimestampOnUpdate(context, { include: ['image.prototype.updateAttributes'] })
        ];
        async.series(hooks, next);
    });

    disableRemoteMethods(Image);
};

/**
 * @param {*} Image
 */
function disableRemoteMethods(Image) {
    Image.disableRemoteMethod('create', true);
    Image.disableRemoteMethod('upsert', true);
    Image.disableRemoteMethod('createChangeStream', true);
    Image.disableRemoteMethod('updateAll', true);
    Image.disableRemoteMethod('__get__message', false);
}