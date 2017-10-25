'use strict';

const async = require('async');
const InternalServerError = require('../../errors/internal_server_error');
const AppContext = require('./../../context');

class NewsfeedEndpoint extends AppContext {

    /**
     * @param {*} app
     * @param {*} logger
     */
    constructor(app, logger) {
        super(app, logger);
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

        let Model = this.getModel('newsfeed');
        let where = { or: [{ creatorId: currentUserId }, { matchedUserId: currentUserId }] };
        Model.destroyAll(where, (err, results) => {
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
    customFind(filter, callback) {
        let fnName = 'customFind';
        filter = filter || {};
        let isReturnCommentsCount = this._isCountComments(filter);

        async.auto({
            collection: callback => {
                this.getCollection('comment', callback);
            },
            news: callback => {
                let Newsfeed = this.getModel('newsfeed');
                Newsfeed.find(filter, callback);
            },
            commentsCount: ['collection', 'news', (results, callback) => {
                if (!isReturnCommentsCount) {
                    return callback();
                }
                let collection = results.collection;
                let ids = results.news.map(item => item.id);
                let query = this._buildCommentsCountQuery(ids);
                this._getCommentsCount(collection, query, callback);
            }],
            formattedResult: ['commentsCount', 'news', (results, callback) => {
                let countsMap = results.commentsCount;
                if (!countsMap) {
                    return callback(null, results.news);
                }
                let data = (results.news || []).map(item => {
                    item.commentsCount = countsMap[item.id] || 0;
                    return item;
                });
                callback(null, data);
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
     * @param {*} filter
     * @param {function} callback
     */
    getPersonal(filter, callback) {
        let fnName = 'getPersonal';
        filter = filter || {};

        async.auto({
            relations: callback => this._getMyRelations(callback),
            newsfeed: ['relations', (results, callback) => {
                if (!results.relations || !results.relations.length) {
                    return callback(null, []);
                }
                filter.where = { creatorId: { inq: results.relations } };
                this.customFind(filter, callback);
            }]
        }, (err, results) => {
            if (err) {
                this.logWarn(fnName, err);
                return callback(err);
            }
            let data = results.newsfeed;
            this.logSuccess(fnName, data);
            callback(null, data);
        });
    }

    /**
     * @param {function} callback
     * @private
     */
    _getMyRelations(callback) {
        let currentUserId = this.getCurrentUserId();
        let Relation = this.getModel('relation');
        Relation.find({ where: { objectId: currentUserId, userExists: true, banned: false } }, (err, results) => {
            if (err) {
                return callback(err);
            }
            let data = (results || []).map(relation => relation.subjectId);
            callback(null, data);
        });
    }

    /**
     * @param {string} newsfeedId
     * @param {function} callback
     */
    createLike(newsfeedId, callback) {
        let fnName = 'createLike';
        this._updateLikes(newsfeedId, 'create', (err, results) => {
            if (err) {
                this.logWarn(fnName, err);
                return callback(err);
            }
            this.logSuccess(fnName, results);
            callback(null, results);
        });
    }

    /**
     * @param {string} newsfeedId
     * @param {function} callback
     */
    removeLike(newsfeedId, callback) {
        let fnName = 'removeLike';
        this._updateLikes(newsfeedId, 'remove', (err, results) => {
            if (err) {
                this.logWarn(fnName, err);
                return callback(err);
            }
            this.logSuccess(fnName, results);
            callback(null, results);
        });
    }

    /**
     * @param {string} id
     * @param {function} callback
     */
    getLikesCount(id, callback) {
        let fnName = 'getLikesCount';
        let Newsfeed = this.getModel('newsfeed');

        Newsfeed.findById(id, (err, instance) => {
            if (err) {
                this.logWarn(fnName, err);
                return callback(err);
            }
            let data = { count: (instance.likes || []).length };
            this.logSuccess(fnName, data);
            callback(null, data);
        });
    }

    /**
     * @param {Array} ids
     * @returns {Array}
     * @private
     */
    _buildCommentsCountQuery(ids) {
        return [
            {
                $match: { newsfeedId: { $in: ids } }
            },
            {
                $group: { _id: "$newsfeedId", count: { $sum: 1 } }
            }
        ];
    }

    /**
     * @param {*} filter
     * @returns {boolean}
     * @private
     */
    _isCountComments(filter) {
        let isReturnCommentsCount = false;
        if (filter.include) {
            if (typeof filter.include === 'string') {
                isReturnCommentsCount = filter.include === 'commentsCount';
                if (isReturnCommentsCount) {
                    delete filter.include;
                }
            }
            if (filter.include instanceof Array) {
                let index = filter.include.indexOf('commentsCount');
                isReturnCommentsCount = index !== -1;
                if (isReturnCommentsCount) {
                    filter.include.splice(index, 1);
                }
            }
        }
        return isReturnCommentsCount;
    }

    /**
     * @param {*} collection
     * @param {*} query
     * @param {function} callback
     * @private
     */
    _getCommentsCount(collection, query, callback) {
        collection.aggregate(query, (err, results) => {
            if (err) {
                return callback(err);
            }
            let map = results.reduce((memo, item) => {
                memo[item._id] = item.count;
                return memo;
            }, {});
            callback(null, map);
        });
    }

    /**
     * @param {string} newsfeedId
     * @param {string} action
     * @param {function} callback
     */
    _updateLikes(newsfeedId, action, callback) {
        let currentUserId = this.getCurrentUserId();

        async.auto({
            newsEvent: callback => {
                let Newsfeed = this.getModel('newsfeed');
                Newsfeed.findById(newsfeedId, callback);
            },
            likes: ['newsEvent', (results, callback) => {
                let newsEvent = results.newsEvent;
                let likes = this._updateLikeState(currentUserId, action, newsEvent.likes || []);
                callback(null, likes);
            }],
            updatedNewsEvent: ['likes', 'newsEvent', (results, callback) => {
                let newsEvent = results.newsEvent;
                newsEvent.likes = results.likes || [];
                newsEvent.save(callback);
            }]
        }, (err, results) => {
            if (err) {
                return callback(err);
            }
            callback(null, { count: results.updatedNewsEvent.likes.length });
        });
    }

    /**
     * @param {string} currentUserId
     * @param {string} action
     * @param {Array.<string>} likes
     * @returns {Array.<string>}
     * @private
     */
    _updateLikeState(currentUserId, action, likes) {
        let index = likes.indexOf(currentUserId);
        if (action === 'create' || index === -1) {
            likes.push(currentUserId);
        }
        if (action === 'remove' || index !== -1) {
            likes.splice(index, 1);
        }
        return likes;
    }
}

module.exports = NewsfeedEndpoint;