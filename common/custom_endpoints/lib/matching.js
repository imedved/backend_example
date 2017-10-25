'use strict';

const async = require('async');
const BadRequestError = require('../../errors/bad_request_error');
const AppContext = require('./../../context');
const LocationType = require('./../../enums').LocationType;

const DEFAULT_PAGING_VALUE = 10;

class MatchingEndpoint extends AppContext {

    /**
     * @param {*} app
     * @param {*} crypto
     * @param {*} logger
     */
    constructor(app, crypto, logger) {
        super(app, logger);
        this._crypto = crypto;
    }

    /**
     * @returns {{id: string, name: string, description: string, isMoving: boolean, moveInDate: string, cityId: string, avatar: {url: string}, apartment: {locationName: string}, relation: {mutualFriendsAvatars: string[], mutualFriendsCount: number, type: number}}}
     */
    getModelSchema() {
        return {
            id: 'string',
            name: 'string',
            description: 'string',
            isMoving: true,
            moveInDate: '2016-01-01T00:00:00.000Z',
            cityId: 'string',
            avatar: { url: 'string' },
            apartment: { locationName: 'string' },
            relation: { mutualFriendsAvatars: ['string'], mutualFriendsCount: 0, type: 0 }
        };
    }

    /**
     * @param {function} callback
     */
    getMatchedUsersCount(callback) {
        let fnName = 'getMatchedUsersCount';

        async.auto({
            collection: callback => {
                this.getCollection('relation', callback);
            },
            relations: ['collection', (results, callback) => {
                let collection = results.collection;
                this._getCountOfValidRelations(collection, callback);
            }]
        }, (err, results) => {
            if (err) {
                this.logWarn(fnName, err);
                return callback(err);
            }
            let data = { count: results.relations };
            this.logSuccess(fnName, data);
            callback(null, data);
        });
    }

    /**
     * @param {string} cursorToken
     * @param {function} callback
     */
    getMatchedUsers(cursorToken, callback) {
        let fnName = 'getMatchedUsers';

        let cursor = this._crypto.decodeData(cursorToken);
        if (cursorToken && !cursor) {
            let err = new BadRequestError('Cursor contains bad value.');
            this.logWarn(fnName, err);
            return callback(err);
        }
        cursor = cursor || { limit: DEFAULT_PAGING_VALUE, offset: 0, diff: 0 };

        async.auto({
            allRelations: callback => {
                this._getAllRelations(callback);
            },
            relationCollection: callback => {
                this.getCollection('relation', callback);
            },
            userCollection: callback => {
                this.getCollection('user', callback);
            },
            relatedUsers: ['relationCollection', (results, callback) => {
                let collection = results.relationCollection;
                this._getRelatedUsers(collection, cursor, callback);
            }],
            strangers: ['allRelations', 'userCollection', 'relatedUsers', (results, callback) => {
                let collection = results.userCollection;
                let allRelations = results.allRelations;
                let relatedUsers = results.relatedUsers;

                cursor.memo = cursor.limit - relatedUsers.length;
                if (cursor.memo === 0) {
                    return callback(null, []);
                }
                this._getStrangers(collection, allRelations, { limit: cursor.memo, offset: cursor.diff }, callback);
            }],
            formattedResult: ['relatedUsers', 'strangers', (results, callback) => {
                let data = results.relatedUsers
                    .concat(results.strangers)
                    .map(user => this._removeFields('relationsLastUpdate', user));

                let response = this._createCursor(cursor, data.length);
                response.result = data;
                callback(null, response);
            }]
        }, (err, results) => {
            if (err) {
                this.logWarn(fnName, err);
                return callback(err);
            }
            let data = results.formattedResult;
            this.logSuccess(fnName, data);
            callback(null, data);
        });
    }

    /**
     * @param {function} callback
     * @private
     */
    _getAllRelations(callback) {
        let currentUserId = this.getCurrentUserId();
        let Relation = this.getModel('relation');
        let query = {
            fields: 'subjectId',
            where: {
                or: [{ objectId: currentUserId }, { subjectId: currentUserId, banned: true }]
            }
        };
        Relation.find(query, (err, results) => {
            if (err) {
                return callback(err);
            }
            let ids = results.map(relation => relation.subjectId);
            callback(null, ids);
        });
    }

    /**
     * @param {*} userCollection
     * @param {Array} ids
     * @param {{ limit, offset }} filter
     * @param {function} callback
     * @private
     */
    _getStrangers(userCollection, ids, filter, callback) {
        let query = this._buildStrangersQuery(ids, filter);
        userCollection.aggregate(query, (err, results) => {
            if (err) {
                return callback(err);
            }
            let data = this._mapStrangers(results);
            callback(null, data);
        });
    }

    /**
     * @param {Array} strangers
     * @returns {Array}
     * @private
     */
    _mapStrangers(strangers) {
        return strangers
            .map(user => {
                let locationName = this._extractLocationName(user);
                user.apartment = locationName ? { locationName: locationName } : null;

                let avatarUrl = this._extractAvatarUrl(user);
                user.avatar = avatarUrl ? { url: avatarUrl } : null;

                user.relation = null;
                user.id = user._id;

                return this._removeFields(['_id', 'location'], user);
            });
    }

    /**
     * @param {*} excludeIds
     * @param {{ limit, offset }} filter
     * @returns {*[]}
     * @private
     */
    _buildStrangersQuery(excludeIds, filter) {
        let currentUserId = this.getCurrentUserId();
        let user = this.getFromContext('currentUser') || { cityId: '' };
        excludeIds.push(currentUserId);

        return [
            {
                $match: { _id: { $nin: excludeIds }, cityId: user.cityId }
            },
            {
                $sort: { created: -1 }
            },
            {
                $lookup: { from: 'image', foreignField: 'avatarId', as: 'avatar', localField: '_id' }
            },
            {
                $lookup: { from: 'location', foreignField: 'userId', as: 'location', localField: '_id' }
            },
            {
                $skip: filter.offset
            },
            {
                $limit: filter.limit
            },
            {
                $project: {
                    _id: 1,
                    birthday: 1,
                    created: 1,
                    name: 1,
                    description: 1,
                    isMoving: 1,
                    moveInDate: 1,
                    cityId: 1,
                    avatar: { url: 1 },
                    location: { name: 1, type: 1 }
                }
            }
        ];
    }

    /**
     * @param {*} relationCollection
     * @param {{ limit, offset }} filter
     * @param {function} callback
     * @private
     */
    _getRelatedUsers(relationCollection, filter, callback) {
        let query = this._buildRelatedUsersQuery(filter);
        relationCollection.aggregate(query, (err, results) => {
            if (err) {
                return callback(err);
            }
            let data = this._mapRelationsToUser(results);
            callback(null, data);
        });
    }

    /**
     * @param {Array} relations
     * @returns {Array}
     * @private
     */
    _mapRelationsToUser(relations) {
        return relations
            .filter(relation => !!relation.subject)
            .map(relation => {
                let subject = relation.subject;

                let locationName = this._extractLocationName(relation);
                subject.apartment = locationName ? { locationName: locationName } : null;

                let avatarUrl = this._extractAvatarUrl(relation);
                subject.avatar = avatarUrl ? { url: avatarUrl } : null;

                subject.relation = {
                    mutualFriendsAvatars: relation.mutualFriendsAvatars,
                    mutualFriendsCount: relation.mutualFriendsCount,
                    type: relation.type
                };
                subject.id = subject._id;
                return this._removeFields('_id', subject);
            });
    }

    /**
     * @param {{ limit, offset }} filter
     * @returns {Array}
     * @private
     */
    _buildRelatedUsersQuery(filter) {
        let currentUserId = this.getCurrentUserId();
        let user = this.getFromContext('currentUser') || { cityId: '' };

        return [
            {
                $match: { objectId: currentUserId, userExists: true, banned: false, follow: false }
            },
            {
                $sort: { type: 1, mutualFriendsCount: -1, follow: 1, created: 1 }
            },
            {
                $lookup: { from: 'user', foreignField: '_id', as: 'subject', localField: 'subjectId' }
            },
            {
                $unwind: '$subject'
            },
            {
                $match: { 'subject.cityId': user.cityId }
            },
            {
                $lookup: { from: 'image', foreignField: 'avatarId', as: 'avatar', localField: 'subjectId' }
            },
            {
                $lookup: { from: 'location', foreignField: 'userId', as: 'location', localField: 'subjectId' }
            },
            {
                $skip: filter.offset
            },
            {
                $limit: filter.limit
            },
            {
                $project: {
                    type: 1,
                    mutualFriendsCount: 1,
                    mutualFriendsAvatars: 1,
                    subject: 1,
                    avatar: { url: 1 },
                    location: { name: 1, type: 1 }
                }
            }
        ];
    }

    /**
     * @returns {Array}
     * @private
     */
    _buildValidRelationsCount() {
        let currentUserId = this.getCurrentUserId();
        let user = this.getFromContext('currentUser') || { cityId: '' };

        return [
            {
                $match: { objectId: currentUserId, userExists: true, banned: false }
            },
            {
                $lookup: { from: 'user', foreignField: '_id', as: 'subject', localField: 'subjectId' }
            },
            {
                $unwind: '$subject'
            },
            {
                $match: { 'subject.cityId': user.cityId }
            },
            {
                $project: { _id: 1 }
            }
        ];
    }

    /**
     * @param {*} relationCollection
     * @param {function} callback
     * @private
     */
    _getCountOfValidRelations(relationCollection, callback) {
        let query = this._buildValidRelationsCount();
        relationCollection.aggregate(query, (err, results) => {
            if (err) {
                return callback(err);
            }
            let data = (results || []).length;
            callback(null, data);
        });
    }

    /**
     * @param {{ avatar: Array }} obj
     * @returns {string}
     * @private
     */
    _extractAvatarUrl(obj) {
        let avatarUrl = null;
        if (obj.avatar && obj.avatar.length) {
            avatarUrl = obj.avatar[0].url;
        }
        return avatarUrl;
    }

    /**
     * @param {{ location: Array }} obj
     * @returns {string}
     * @private
     */
    _extractLocationName(obj) {
        let locationName = null;
        if (obj.location && obj.location.length) {
            obj.location.forEach(location => {
                if (location.type === LocationType.APARTMENT) {
                    locationName = location.name;
                }
            });
        }
        return locationName;
    }

    /**
     * @param {{limit, offset, diff, memo}} oldCursor
     * @returns {*}
     * @private
     */
    _createNextCursor(oldCursor) {
        let next = {
            limit: oldCursor.limit,
            offset: oldCursor.offset + DEFAULT_PAGING_VALUE,
            diff: oldCursor.diff + oldCursor.memo
        };
        return this._crypto.encodeData(next) || null;
    }

    /**
     * @param {{limit, offset, diff, memo}} oldCursor
     * @returns {*}
     * @private
     */
    _createPreviousCursor(oldCursor) {
        let diff = oldCursor.diff - oldCursor.memo;
        let prev = {
            limit: oldCursor.limit,
            offset: oldCursor.offset - DEFAULT_PAGING_VALUE,
            diff: diff >= 0 ? diff : 0
        };
        return this._crypto.encodeData(prev) || null;
    }

    /**
     * @param {{limit, offset, diff, memo}} cursor
     * @param {number} dataCount
     * @returns {{next, previous}}
     * @private
     */
    _createCursor(cursor, dataCount) {
        let next = cursor.limit <= dataCount ? this._createNextCursor(cursor) : null;
        let previous = cursor.diff > 0 ? this._createPreviousCursor(cursor) : null;

        return { next: next, previous: previous };
    }

    /**
     * @param {Array|string} fields
     * @param {*} obj
     * @returns {*}
     * @private
     */
    _removeFields(fields, obj) {
        if (!obj) {
            return obj;
        }

        if (typeof fields === 'string') {
            fields = [fields];
        }

        (fields || []).forEach(field => {
            if (obj[field]) delete obj[field];
        });
        return obj;
    }
}

module.exports = MatchingEndpoint;