'use strict';

const async = require('async');
const cps = require('continuate');
const InternalServerError = require('../../errors/internal_server_error');
const BadRequestError = require('../../errors/bad_request_error');
const ModelNotFoundError = require('../../errors/model_not_found_error');
const AppContext = require('./../../context');

const RelationType = {
    FRIEND: 10,
    FRIEND_OF_FRIEND: 20,
    STRANGER: 30
};

class RelationEndpoint extends AppContext {

    /**
     * @param {*} app
     * @param {*} moment
     * @param {*} logger
     * @param {{ relationUpdatePeriodValue, relationUpdatePeriodType }} config
     */
    constructor(app, moment, logger, config) {
        super(app, logger);
        this._moment = moment;
        this._config = {
            relationUpdatePeriodValue: config.relationUpdatePeriodValue,
            relationUpdatePeriodType: config.relationUpdatePeriodType,
            env: config.env
        };
    }

    /**
     * @param {function} callback
     */
    removeAllMy(callback) {
        let fnName = 'removeAllMy';
        let currentUserId = this.getCurrentUserId();
        if (!currentUserId) {
            let err = new InternalServerError('Bad session. Current user id is null.');
            this.logWarn(fnName, err);
            return callback(err);
        }

        let Relation = this.getModel('relation');
        Relation.destroyAll({ objectId: currentUserId }, (err, results) => {
            if (err) {
                this.logWarn(fnName, err);
                return callback(err);
            }
            this.logSuccess(fnName, results);
            callback(null, results);
        });
    }

    /**
     * @param {*} filter
     * @param {function} callback
     */
    getAllMy(filter, callback) {
        let fnName = 'getAllMy';
        let currentUserId = this.getCurrentUserId();

        filter = filter || {};
        filter.where = { objectId: currentUserId };

        let Relation = this.getModel('relation');
        Relation.find(filter, (err, results) => {
            if (err) {
                this.logWarn(fnName, err);
                return callback(err);
            }
            this.logSuccess(fnName, results);
            callback(null, results);
        });
    }

    /**
     * @param {{ follow, banned, subjectId }} body
     * @param {function} callback
     * @returns {*}
     */
    customUpsert(body, callback) {
        let fnName = 'customUpsert';

        if (typeof body.subjectId !== 'string' || !body.subjectId) {
            let err = new BadRequestError('Field "subjectId" should be defined.');
            this.logWarn(fnName, err);
            return callback(err);
        }

        if (typeof body.banned === 'undefined' && typeof body.follow === 'undefined') {
            let err = new BadRequestError('One (or more) of next fields "banned", "follow" should be defined.');
            this.logWarn(fnName, err);
            return callback(err);
        }

        let Relation = this.getModel('relation');
        async.auto({
            relation: callback => {
                let currentUserId = this.getCurrentUserId();
                let relationId = `${currentUserId}:${body.subjectId}`;
                Relation.findById(relationId, callback);
            },
            update: ['relation', (results, callback) => {
                if (!results.relation) {
                    return callback();
                }
                body.modified = new Date();
                results.relation.updateAttributes(body, callback);
            }],
            create: ['relation', (results, callback) => {
                if (results.relation) {
                    return callback();
                }
                let relation = this._createRelation(this.getDefaultType(), body.subjectId, [], true);
                relation.banned = body.banned || false;
                relation.follow = body.follow || false;

                Relation.create(relation, callback);
            }]
        }, (err, results) => {
            if (err) {
                this.logWarn(fnName, err);
                return callback(err);
            }
            let data = results.update || results.create;
            this.logSuccess(fnName, data);
            callback(null, data);
        });
    }

    /**
     * @param {{ bulk: Array.<Relation> }} body
     * @param {function} callback
     * @returns {*}
     */
    bulkCreate(body, callback) {
        let fnName = 'bulkCreate';
        let data = body.bulk;
        if (!data) {
            let err = new BadRequestError('Bulk must be defined.');
            this.logWarn(fnName, err);
            return callback(err);
        }
        if (!(data instanceof Array)) {
            let err = new BadRequestError('Bulk must be array.');
            this.logWarn(fnName, err);
            return callback(err);
        }

        let Relation = this.getModel('relation');

        data.forEach(item => item.id = this.generateId(item));
        Relation.create(data, (err, results) => {
            if (err) {
                this.logWarn(fnName, err);
                return callback(err);
            }
            this.logSuccess(fnName, results);
            callback(null, results);
        });
    }

    /**
     * @param {boolean} force
     * @param {function} callback
     */
    updateOrCreateAll(force, callback) {
        let fnName = 'updateOrCreateAll';
        this._verifyLastUpdateDate((err, lastUpdateDate) => {
            if (err) {
                this.logWarn(fnName, err);
                return callback(err);
            }
            if (!force && !lastUpdateDate.valid) {
                let defaultValue = { created: 0, modified: 0, lastUpdateDate: lastUpdateDate.date };
                this.logSuccess(fnName, defaultValue);
                return callback(null, defaultValue);
            }

            async.auto({
                followers: callback => {
                    this._getFollowersIds(callback);
                },
                facebookFriends: callback => {
                    this._getFacebookFriends(callback);
                },
                friendsRelations: ['facebookFriends', (results, callback) => {
                    let friendsIds = results.facebookFriends.map(facebookUser => facebookUser.id);
                    this._getFriendOfFriendRelations(friendsIds, callback);
                }],
                existingUsers: ['facebookFriends', 'friendsRelations', (results, callback) => {
                    let relationsIds = results.friendsRelations.map(relation => relation.subjectId);
                    let friendsIds = results.facebookFriends.map(facebookUser => facebookUser.id);
                    this._getUsersById(friendsIds.concat(relationsIds), callback);
                }],
                mutualFriends: ['facebookFriends', 'friendsRelations', (results, callback) => {
                    let relationsIds = results.friendsRelations.map(relation => relation.subjectId);
                    let friendsIds = results.facebookFriends.map(facebookUser => facebookUser.id);

                    let Set = {};
                    relationsIds.concat(friendsIds).forEach(id => Set[id] = true);
                    let allIds = Object.keys(Set);

                    this._getMutualFriends(allIds, callback);
                }],
                allRelations: ['mutualFriends', 'friendsRelations', 'facebookFriends', 'followers', (results, callback) => {
                    let friends = results.facebookFriends;
                    let friendsRelations = results.friendsRelations;
                    let mutualFriends = results.mutualFriends;
                    let existingUsers = results.existingUsers;
                    let followersIds = results.followers;

                    let formRelations = cps(this._formRelations.bind(this));
                    formRelations(friends, friendsRelations, followersIds, mutualFriends, existingUsers, callback);
                }],
                existingRelations: ['allRelations', (results, callback) => {
                    let allRelationsIds = results.allRelations.map(relation => relation.subjectId);
                    this._getCurrentUserRelations(allRelationsIds, callback);
                }],
                createdRelations: ['allRelations', 'existingRelations', (results, callback) => {
                    let existingRelations = results.existingRelations;
                    let allRelations = results.allRelations;
                    this._createRelations(allRelations, existingRelations, callback);
                }],
                updatedRelations: ['allRelations', 'existingRelations', (results, callback) => {
                    let existingRelations = results.existingRelations;
                    let allRelations = results.allRelations;
                    this._updateRelations(allRelations, existingRelations, callback);
                }],
                updatedProfile: ['createdRelations', (results, callback) => {
                    this._setLastUpdateDate(callback);
                }]
            }, (err, result) => {
                if (err) {
                    this.logWarn(fnName, err);
                    return callback(err);
                }
                let data = {
                    created: result.createdRelations.length,
                    modified: result.updatedRelations ? result.updatedRelations.nModified : 0,
                    lastUpdateDate: result.updatedProfile
                };
                this.logSuccess(fnName, data);
                callback(null, data);
            });
        });
    }

    /**
     * @param {function} callback
     * @private
     */
    _getFollowersIds(callback) {
        let Relation = this.getModel('relation');
        let currentUserId = this.getCurrentUserId();
        let query = { fields: 'objectId', where: { subjectId: currentUserId, banned: false, type: RelationType.STRANGER } };
        Relation.find(query, (err, results) => {
            if (err) {
                return callback(err);
            }
            let ids = results.map(relation => relation.objectId);
            callback(null, ids);
        });
    }

    /**
     * @param {Array} allRelations
     * @param {*} existingRelations
     * @param {function} callback
     * @private
     */
    _updateRelations(allRelations, existingRelations, callback) {
        async.auto({
            collection: callback => {
                this.getCollection('relation', callback);
            },
            formattedData: callback => {
                let isRelationValid = relation => {
                    let exists = existingRelations[relation.subjectId];
                    if (!exists) {
                        return false;
                    }
                    let avatarsDiff = (exists.mutualFriendsAvatars || []).length !== (relation.mutualFriendsAvatars || []).length;
                    let friendsDiff = exists.mutualFriendsCount !== relation.mutualFriendsCount;
                    let existsDiff = exists.userExists !== relation.userExists;
                    return avatarsDiff || friendsDiff || existsDiff;
                };

                let filterUniqueRelations = this._filterUniqueRelations.bind(this);
                cps(filterUniqueRelations)(allRelations, isRelationValid, callback);
            },
            update: ['collection', 'formattedData', (results, callback) => {
                let collection = results.collection;
                let formattedData = results.formattedData;
                if (!formattedData || !formattedData.length) {
                    return callback();
                }

                this._executeBulkUpdateRelations(collection, formattedData, callback);
            }]
        }, (err, results) => {
            if (err) {
                return callback(err);
            }
            if (!results.update) {
                return callback(null);
            }
            callback(null, results.update.toJSON());
        });
    }

    /**
     * @param {*} collection
     * @param {Array} relations
     * @param {function} callback
     * @private
     */
    _executeBulkUpdateRelations(collection, relations, callback) {
        let bulk = collection.initializeUnorderedBulkOp();
        relations.forEach(relation => {
            let avatars = (relation.mutualFriendsAvatars || []).slice(0, 4);
            bulk.find({
                subjectId: relation.subjectId,
                objectId: relation.objectId
            }).update({
                $set: {
                    mutualFriendsAvatars: avatars,
                    mutualFriendsCount: relation.mutualFriendsCount,
                    userExists: relation.userExists
                }
            });
        });
        bulk.execute(callback);
    }

    /**
     * @param {Array} allRelations
     * @param {*} existingRelations
     * @param {function} callback
     * @private
     */
    _createRelations(allRelations, existingRelations, callback) {
        let Relation = this.getModel('relation');
        let data = this._filterUniqueRelations(allRelations, relation => !existingRelations[relation.subjectId]);
        data.forEach(item => item.id = this.generateId(item));
        Relation.create(data, callback);
    }

    /**
     * @param {Array} friends
     * @param {Array} friendsRelations
     * @param {Array} strangersIds
     * @param {Array} mutualFriends
     * @param {Array} existingUsers
     * @returns {*}
     * @private
     */
    _formRelations(friends, friendsRelations, strangersIds, mutualFriends, existingUsers) {
        let closeRelations = this._formCloseRelations(friends, mutualFriends, existingUsers);
        let distantRelations = this._formDistantRelations(friendsRelations, mutualFriends, existingUsers);
        let strangersRelations = this._formStrangerRelations(strangersIds);

        return closeRelations
            .concat(distantRelations)
            .concat(strangersRelations)
            .filter(relation => relation.subjectId !== relation.objectId);
    }


    /**
     * @param {Array} allRelations
     * @param {function} predicate
     * @returns {Array}
     * @private
     */
    _filterUniqueRelations(allRelations, predicate) {
        let map = {};
        let data = [];
        allRelations.forEach(relation => {
            let key = this._createComplexId(relation);
            if (predicate(relation) && !map[key]) {
                data.push(relation);
                map[key] = true;
            }
        });
        return data;
    }

    /**
     * @param {Array} usersIds
     * @returns {*}
     * @private
     */
    _formStrangerRelations(usersIds) {
        return usersIds.map(id => this._createRelation(RelationType.STRANGER, id, [], true));
    }

    /**
     * @param {Array} friendsRelations
     * @param {*} mutualFriends
     * @param {*} existingUsers
     * @returns {Array}
     * @private
     */
    _formDistantRelations(friendsRelations, mutualFriends, existingUsers) {
        return friendsRelations.map(relation => {
            let friends = mutualFriends[relation.subjectId] || [];
            let exists = existingUsers.indexOf(relation.subjectId) > -1;
            return this._createRelation(RelationType.FRIEND_OF_FRIEND, relation.subjectId, friends, exists);
        });
    }

    /**
     * @param {Array} facebookFriends
     * @param {*} mutualFriends
     * @param {*} existingUsers
     * @returns {Array}
     * @private
     */
    _formCloseRelations(facebookFriends, mutualFriends, existingUsers) {
        return facebookFriends.map(facebookUser => {
            let friends = mutualFriends[facebookUser.id] || [];
            let exists = existingUsers.indexOf(facebookUser.id) > -1;
            return this._createRelation(RelationType.FRIEND, facebookUser.id, friends, exists);
        });
    }

    /**
     * @param {Function} callback
     * @private
     */
    _verifyLastUpdateDate(callback) {
        let currentUserId = this.getCurrentUserId();
        let User = this.getModel('user');

        User.findById(currentUserId, { fields: ['relationsLastUpdate'] }, (err, result) => {
            if (err) {
                return callback(err);
            }
            if (!result) {
                return callback(new ModelNotFoundError('user', currentUserId));
            }
            if (!result.relationsLastUpdate) {
                return callback(null, true);
            }
            let date = this._calcLastPossibleUpdateDate();
            callback(null, { valid: result.relationsLastUpdate < date, date: result.relationsLastUpdate });
        });
    }

    /**
     * @param {Array.<string>} ids
     * @param {function} callback
     * @private
     */
    _getMutualFriends(ids, callback) {
        let Friend = this.getModel('friend');
        Friend.getMutualFriendsBulk({ bulk: ids }, null, (err, results) => {
            if (err) {
                return callback(err);
            }
            let data = this._groupMutualFriends(results);
            callback(null, data);
        });
    }

    /**
     * @param {Array.<string>} friendsIds
     * @param {function} callback
     * @private
     */
    _getFriendOfFriendRelations(friendsIds, callback) {
        let Relation = this.getModel('relation');
        let query = { where: { objectId: { inq: friendsIds }, type: RelationType.FRIEND } };
        Relation.find(query, callback);
    }

    /**
     * @param {Array} subjectIds
     * @param {function} callback
     */
    _getCurrentUserRelations(subjectIds, callback) {
        let currentUserId = this.getCurrentUserId();
        let Relation = this.getModel('relation');

        let query = { where: { objectId: currentUserId, subjectId: { inq: subjectIds } } };
        Relation.find(query, (err, relations) => {
            if (err) {
                return callback(err);
            }
            let relationMap = relations.reduce((memo, relation) => {
                memo[relation.subjectId] = relation;
                return memo;
            }, {});
            callback(null, relationMap);
        });
    }

    /**
     * @param {*} relation
     * @returns {string}
     * @private
     */
    _createComplexId(relation) {
        return `${relation.subjectId}:${relation.objectId}`
    }

    /**
     * @param {Function} callback
     * @private
     */
    _setLastUpdateDate(callback) {
        let currentUserId = this.getCurrentUserId();
        let User = this.getModel('user');
        let date = new Date();
        User.update({ id: currentUserId }, { relationsLastUpdate: date }, (err) => {
            if (err) {
                return callback(err);
            }
            callback(null, date);
        });
    }

    /**
     * @returns {Date}
     * @private
     */
    _calcLastPossibleUpdateDate() {
        let value = this._config.relationUpdatePeriodValue;
        let type = this._config.relationUpdatePeriodType;
        return new Date(this._moment().subtract(value, type).unix() * 1000);
    }

    /**
     * @param {Function} callback
     * @private
     */
    _getFacebookFriends(callback) {
        let Friend = this.getModel('friend');
        Friend.getAllFriends({}, callback);
    }

    /**
     * @param {Array.<string>} usersIds
     * @param {function} callback
     * @private
     */
    _getUsersById(usersIds, callback) {
        let User = this.getModel('user');

        let query = { fields: ['id'], where: { id: { inq: usersIds } } };
        User.find(query, (err, result) => {
            if (err) {
                return callback(err);
            }
            let data = (result || []).map(user => user.id);
            callback(null, data);
        });
    }

    /**
     * @param {Array.<{ friendId }>} mutualFriends
     * @returns {*}
     */
    _groupMutualFriends(mutualFriends) {
        return mutualFriends.reduce((memo, friend) => {
            if (memo[friend.friendId]) {
                memo[friend.friendId].push(friend);
            } else {
                memo[friend.friendId] = [friend];
            }
            return memo;
        }, {});
    }

    /**
     * @param {number} type
     * @param {string} subjectId
     * @param {Array} mutualFriends
     * @param {boolean} exists
     * @private
     */
    _createRelation(type, subjectId, mutualFriends, exists) {
        let currentUserId = this.getCurrentUserId();

        let avatars = (mutualFriends || [])
            .slice(0, 4)
            .filter(facebookUser => facebookUser.picture && facebookUser.picture.data && facebookUser.picture.data.url)
            .map(facebookUser => facebookUser.picture.data.url);

        return {
            id: `${currentUserId}:${subjectId}`,
            banned: false,
            follow: false,
            type: type,
            objectId: currentUserId,
            mutualFriendsCount: mutualFriends.length,
            mutualFriendsAvatars: avatars,
            subjectId: subjectId,
            userExists: exists,
            created: new Date(),
            modified: new Date()
        };
    }

    /**
     * @param {{ objectId, subjectId }} obj
     * @returns {string}
     */
    generateId(obj) {
        return obj.objectId + ':' + obj.subjectId;
    }

    /**
     * @returns {number}
     */
    getDefaultType() {
        return RelationType.STRANGER;
    }
}

module.exports = RelationEndpoint;