'use strict';

let moment = require('moment');

let ChatEndpoint = require('./lib/chat');
let FriendEndpoint = require('./lib/friend');
let ImageEndpoint = require('./lib/image');
let MatchingEndpoint = require('./lib/matching');
let MessageEndpoint = require('./lib/message');
let NewsfeedEndpoint = require('./lib/newsfeed');
let RelationEndpoint = require('./lib/relation');
let TagEndpoint = require('./lib/tag');
let UserEndpoint = require('./lib/user');
let LocationEndpoint = require('./lib/location');
let ApartmentEndpoint = require('./lib/apartment');
let CommentEndpoint = require('./lib/comment');
let SettingEndpoint = require('./lib/setting');
let TokenEndpoint = require('./lib/token');

let app = require('../../server/server');
let log4js = require('../utils').log4js;
let crypto = require('../utils').crypto;
let facebookRepository = require('../repositories').facebook;
let caseConverter = require('../utils').caseConverter;

let logger = (name) => log4js.fork(name, app.get('logLevel'));

module.exports = {
    chat: new ChatEndpoint(app, logger('Chat')),
    friend: new FriendEndpoint(app, facebookRepository, caseConverter, logger('Friend')),
    image: new ImageEndpoint(app, logger('Image')),
    matching: new MatchingEndpoint(app, crypto, logger('Matching')),
    message: new MessageEndpoint(app, logger('Message')),
    newsfeed: new NewsfeedEndpoint(app, logger('Newsfeed')),
    relation: new RelationEndpoint(app, moment, logger('Relation'), {
        relationUpdatePeriodValue: app.get('relationUpdatePeriodValue'),
        relationUpdatePeriodType: app.get('relationUpdatePeriodType'),
        env: app.get('env')
    }),
    tag: new TagEndpoint(app, logger('Tag')),
    user: new UserEndpoint(app, facebookRepository, crypto, logger('User'), {
        accessTokenTtlType: app.get('accessTokenTtlType'),
        accessTokenTtlValue: app.get('accessTokenTtlValue')
    }),
    location: new LocationEndpoint(app, logger('Location')),
    apartment: new ApartmentEndpoint(app, logger('Apartment')),
    comment: new CommentEndpoint(app, logger('Comment')),
    setting: new SettingEndpoint(app, logger('Setting')),
    token: new TokenEndpoint(app, logger('Token'))
};