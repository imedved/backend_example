'use strict';

let async = require('async');
let contextManager = require('../hooks').contextManager;
let injector = require('../hooks').injector;
let tagEndpoint = require('../custom_endpoints').tag;

module.exports = (Tag) => {

    Tag.addToUser = tagEndpoint.bulkCreate.bind(tagEndpoint);
    Tag.remoteMethod('addToUser',
        {
            description: 'Add a related items by id for users.',
            accepts: [
                {
                    arg: 'data',
                    type: '{ "bulk": ["title"] }',
                    http: { source: 'body' },
                    required: true
                }
            ],
            http: { path: '/addToUser', verb: 'post' },
            returns: { root: true, type: ['tag'] }
        }
    );

    Tag.linkToUser = tagEndpoint.bulkLink.bind(tagEndpoint);
    Tag.remoteMethod('linkToUser',
        {
            description: 'Link a related items by id for users.',
            accepts: [
                {
                    arg: 'data',
                    type: '{ "bulk": ["tagId"] }',
                    http: { source: 'body' },
                    required: true
                }
            ],
            http: { path: '/linkToUser', verb: 'post' },
            returns: { arg: 'count', type: 'number' }
        }
    );

    Tag.removeFromUser = tagEndpoint.removeLinksFromUser.bind(tagEndpoint);
    Tag.remoteMethod('removeFromUser',
        {
            description: 'Link a related items by id for users.',
            accepts: [
                {
                    arg: 'data',
                    type: '{ "bulk": ["tagId"] }',
                    http: { source: 'body' },
                    required: true
                }
            ],
            http: { path: '/removeFromUser', verb: 'post' },
            returns: { arg: 'count', type: 'number' }
        }
    );

    Tag.beforeRemote('**', (context, unused, next) => {
        let hooks = [
            contextManager.verifyToken(context),
            // contextManager.verifyPermissions(context, {
            //     userIdFields: ['userId'],
            //     include: ['tag.prototype.updateAttributes', 'tag.deleteById']
            // }),
            injector.removeFields(context, {
                fields: ['id', 'created', 'modified'],
                include: ['tag.create', 'tag.prototype.updateAttributes']
            }),
            injector.addTimestampOnCreate(context, { include: ['tag.create'] }),
            injector.addTimestampOnUpdate(context, { include: ['tag.prototype.updateAttributes'] })
        ];
        async.series(hooks, next);
    });

    disableRemoteMethods(Tag);
};

/**
 * @param {*} Tag
 */
function disableRemoteMethods(Tag) {
    Tag.disableRemoteMethod('createChangeStream', true);
    Tag.disableRemoteMethod('updateAll', true);
    Tag.disableRemoteMethod('upsert', true);

    Tag.disableRemoteMethod('__create__users', false);
    Tag.disableRemoteMethod('__delete__users', false);
    Tag.disableRemoteMethod('__destroyById__users', false);
    Tag.disableRemoteMethod('__updateById__users', false);
}
