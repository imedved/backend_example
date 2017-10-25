'use strict';

let async = require('async');
let BadRequestError = require('../../errors/bad_request_error');
let AppContext = require('./../../context');

class TagEndpoint extends AppContext {

    /**
     * @param {*} app
     * @param {*} logger
     */
    constructor(app, logger) {
        super(app, logger);
    }

    /**
     * @param {{ bulk }} body
     * @param {function} callback
     * @returns {*}
     */
    bulkCreate(body, callback) {
        let method = 'bulkCreate';
        let currentUserId = this.getCurrentUserId();

        let titles = body.bulk;
        if (!titles) {
            return callback(new BadRequestError('Bulk must be defined.'));
        }
        if (!(titles instanceof Array)) {
            return callback(new BadRequestError('Bulk must be array of String.'))
        }
        let data = titles.map(text => ({ title: text }));

        async.auto({
            user: callback => {
                let User = this.getModel('user');
                User.findById(currentUserId, callback);
            },
            createdTags: ['user', (results, callback) => {
                results.user.tags.create(data, callback);
            }]
        }, (err, results) => {
            if (err) {
                this.logWarn(method, err);
                return callback(err);
            }
            let data = results.createdTags;
            this.logSuccess(method, data);
            callback(null, data);
        });
    }

    /**
     * @param {*} body
     * @param {function} callback
     * @returns {*}
     */
    removeLinksFromUser(body, callback) {
        let method = 'removeLinksFromUser';
        let currentUserId = this.getCurrentUserId();

        let tagsIds = body.bulk;
        if (!tagsIds) {
            let err = new BadRequestError('Field "bulk" must be defined.');
            this.logWarn(method, err);
            return callback(err);
        }
        if (!(tagsIds instanceof Array)) {
            let err = new BadRequestError('Field "bulk" must be an array of String.');
            this.logWarn(method, err);
            return callback(err);
        }

        async.auto({
            collection: callback => {
                this.getCollection('taguser', callback)
            },
            removedCount: ['collection', (results, callback) => {
                results.collection.remove({ userId: currentUserId, tagId: { $in: tagsIds } }, callback);
            }]
        }, (err, results) => {
            if (err) {
                this.logWarn(method, err);
                return callback(err);
            }
            let data = results.removedCount.result.n || 0;
            this.logSuccess(method, data);
            callback(null, data);
        });
    }

    /**
     * @param {{bulk}} body
     * @param {function} callback
     * @returns {*}
     */
    bulkLink(body, callback) {
        let method = 'bulkLink';
        let currentUserId = this.getCurrentUserId();

        let tagsIds = body.bulk;
        if (!tagsIds) {
            let err = new BadRequestError('Field "bulk" must be defined.');
            this.logWarn(method, err);
            return callback(err);
        }
        if (!(tagsIds instanceof Array)) {
            let err = new BadRequestError('Field "bulk" must be an array of String.');
            this.logWarn(method, err);
            return callback(err);
        }

        async.auto({
            tags: callback => {
                this._getTagsByIdRange(tagsIds, callback);
            },
            collection: callback => {
                this.getCollection('taguser', callback)
            },
            existingLinks: ['collection', (results, callback) => {
                this._getAllTagsForCurrentUser(results.collection, callback);
            }],
            newLinks: ['tags', 'existingLinks', (results, callback) => {
                let tagMap = this._groupBy('id', results.tags);
                let linkMap = this._groupBy('tagId', results.existingLinks);
                let data = tagsIds.filter(id => !linkMap[id] && tagMap[id]).map(tagId => ({
                    userId: currentUserId,
                    tagId: tagId
                }));
                callback(null, data);
            }],
            createdLinks: ['collection', 'newLinks', (results, callback) => {
                let newLinks = results.newLinks;
                if (!newLinks || !newLinks.length) {
                    return callback(null, []);
                }
                this._linkTagsAndCurrentUser(results.collection, newLinks, callback);
            }]
        }, (err, results) => {
            if (err) {
                this.logWarn(method, err);
                return callback(err);
            }
            let data = results.createdLinks.insertedCount || 0;
            this.logSuccess(method, data);
            callback(null, data);
        });
    }

    /**
     * @param {Array} tagsIds
     * @param {function} callback
     * @private
     */
    _getTagsByIdRange(tagsIds, callback) {
        let Tag = this.getModel('tag');
        Tag.find({ fields: 'id', where: { id: { inq: tagsIds } } }, callback);
    }

    /**
     * @param {*} collection
     * @param {Array} links
     * @param {function} callback
     * @private
     */
    _linkTagsAndCurrentUser(collection, links, callback) {
        collection.insert(links, (err, results) => {
            if (err) {
                return callback(err);
            }
            callback(null, results);
        });
    }

    /**
     * @param {*} tagCollection
     * @param {function} callback
     * @private
     */
    _getAllTagsForCurrentUser(tagCollection, callback) {
        let currentUserId = this.getCurrentUserId();
        tagCollection.find({ userId: currentUserId }, {}, (err, cursor) => {
            if (err) {
                return callback(err);
            }
            cursor.toArray(callback);
        });
    }

    /**
     * @param {string} field
     * @param {Array} array
     * @returns {*}
     * @private
     */
    _groupBy(field, array) {
        return array.reduce((memo, item) => {
            memo[item[field]] = item;
            return memo;
        }, {});
    }
}

module.exports = TagEndpoint;
