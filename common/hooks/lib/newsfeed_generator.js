'use strict';

let async = require('async');
let AppContext = require('../../context');

class NewsfeedGenerator extends AppContext {

    /**
     * @param {*} app
     * @param {*} logger
     */
    constructor(app, logger) {
        super(app, logger);
    }

    /**
     * @param {*} ctx
     * @param {*} instance
     * @param {function} next
     */
    onRelationUpdateOrCreate(ctx, instance, next) {
        let fnName = 'onRelationUpdateOrCreate';
        let body = ctx.req.body;

        if (!body.follow) {
            return next();
        }

        async.auto({
            relations: callback => {
                let Relation = this.getModel('relation');
                let object = Relation.generateId(instance);
                let subject = Relation.generateId({ subjectId: instance.objectId, objectId: instance.subjectId });
                Relation.find({ where: { id: { inq: [object, subject] } } }, callback);
            },
            newsEvent: ['relations', (results, callback) => {
                let relations = results.relations;
                if (relations.length < 2) {
                    return callback(null, null);
                }
                let follow = relations.every(relation => relation.follow);
                if (!follow) {
                    return callback(null, null);
                }
                this._createFollowEvent(instance.objectId, instance.subjectId, callback);
            }],
            chat: ['newsEvent', (results, callback) => {
                if (!results.newsEvent) {
                    return callback();
                }
                this._createChat(instance.objectId, instance.subjectId, callback);
            }]
        }, (err, results) => {
            if (err) {
                this.logWarn(fnName, err);
                return next();
            }
            if (results.newsEvent) {
                this.logSuccess(fnName, results.newsEvent);
            }
            next();
        });
    }

    /**
     * @param {*} ctx
     * @param {*} instance
     * @param {function} next
     */
    onUserUpdate(ctx, instance, next) {
        let fnName = 'onUserUpdate';
        let body = ctx.req.body;
        let City = this.getModel('city');

        async.auto({
            movement: callback => {
                if (typeof body.isMoving === 'undefined') {
                    return callback();
                }
                this._createMoveinEvent(instance, callback);
            },
            city: callback => {
                if (typeof body.cityId === 'undefined') {
                    return callback();
                }
                City.findById(body.cityId, callback);
            },
            changedCity: ['city', (results, callback) => {
                if (!results.city) {
                    return callback();
                }
                this._createUpdatedCityEvent(instance, callback);
            }]
        }, (err, results) => {
            if (err) {
                this.logWarn(fnName, err);
                return next();
            }
            if (results.movement || results.changedCity) {
                let data = { movement: results.movement, changedCity: results.changedCity };
                this.logSuccess(fnName, data);
            }
            next();
        });
    }

    /**
     * @param {*} ctx
     * @param {*} instance
     * @param {function} next
     */
    onApartmentCreate(ctx, instance, next) {
        let fnName = 'onApartmentCreate';
        let body = ctx.req.body;

        if (!body.userId) {
            return next();
        }

        let User = this.getModel('user');
        async.auto({
            user: callback => {
                User.findById(body.userId, callback);
            },
            event: ['user', (results, callback) => {
                if (!results.user) {
                    return callback();
                }
                this._createChangeApartmentEvent(body.userId, callback);
            }]
        }, (err, results) => {
            if (err) {
                this.logWarn(fnName, err);
                return next();
            }
            if (results.event) {
                this.logSuccess(fnName, results.event);
            }
            next();
        });
    }

    /**
     * @param {*} objectId
     * @param {*} subjectId
     * @param {function} callback
     * @private
     */
    _createFollowEvent(objectId, subjectId, callback) {
        let Newsfeed = this.getModel('newsfeed');
        let newsEvent = {
            eventType: 'matchFriends',
            text: `MATCH_FRIENDS_EVENT`,
            creatorId: objectId,
            matchedUserId: subjectId,
            created: new Date(),
            modified: new Date()
        };
        Newsfeed.create(newsEvent, callback);
    }

    /**
     * @param {string} objectId
     * @param {string} subjectId
     * @param {function} callback
     * @private
     */
    _createChat(objectId, subjectId, callback) {
        let Chat = this.getModel('chat');
        let chat = {
            creatorId: objectId,
            opponentId: subjectId,
            creatorHasUnreadMessages: true,
            opponentHasUnreadMessages: true,
            created: new Date(),
            modified: new Date()
        };
        Chat.create(chat, callback);
    }

    /**
     * @param {*} instance
     * @param {function} callback
     * @private
     */
    _createMoveinEvent(instance, callback) {
        let Newsfeed = this.getModel('newsfeed');
        let newsEvent = {
            text: `MOVE_IN_EVENT`,
            eventType: 'updateOption',
            creatorId: instance.id,
            isMoving: instance.isMoving,
            created: new Date(),
            modified: new Date()
        };
        Newsfeed.create(newsEvent, callback);
    }

    /**
     * @param {*} instance
     * @param {function} callback
     * @private
     */
    _createUpdatedCityEvent(instance, callback) {
        let Newsfeed = this.getModel('newsfeed');
        let newsEvent = {
            text: `UPDATE_CITY_EVENT`,
            eventType: 'updateCity',
            creatorId: instance.id,
            cityId: instance.cityId,
            created: new Date(),
            modified: new Date()
        };
        Newsfeed.create(newsEvent, callback);
    }

    /**
     * @param {string} userId
     * @param {function} callback
     * @private
     */
    _createChangeApartmentEvent(userId, callback) {
        let Newsfeed = this.getModel('newsfeed');
        let newsEvent = {
            text: `CHANGE_APARTMENT_EVENT`,
            eventType: 'updateOption',
            creatorId: userId,
            created: new Date(),
            modified: new Date()
        };
        Newsfeed.create(newsEvent, callback);
    }
}

module.exports = NewsfeedGenerator;