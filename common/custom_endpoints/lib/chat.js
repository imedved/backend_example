'use strict';

const async = require('async');
const BadRequestError = require('../../errors/bad_request_error');
const InternalServerError = require('../../errors/internal_server_error');
const AppContext = require('./../../context');

class ChatEndpoint extends AppContext {

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

        let Chat = this.getModel('chat');
        let where = { or: [{ creatorId: currentUserId }, { opponentId: currentUserId }] };
        Chat.destroyAll(where, (err, results) => {
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
     * @param {Function} callback
     */
    getMyChats(filter, callback) {
        let fnName = 'getMyChats';
        let currentUserId = this.getCurrentUserId();
        filter = filter || {};

        if (filter.where) {
            let err = new BadRequestError('Field "where" is not available.');
            this.logWarn(fnName, err);
            return callback(err)
        }

        filter.where = { or: [{ creatorId: currentUserId }, { opponentId: currentUserId }] };
        filter.limit = filter.limit || 100;
        filter.offset = filter.offset || 0;

        const customFilters = {
            lastMessage: 'last_message',
            unreadCount: 'unread_count'
        };

        let isIncludeLastMessage = filter.include == customFilters.lastMessage;
        let isIncludeUnreadCount = filter.include == customFilters.unreadCount;

        if (filter.include === customFilters.lastMessage || filter.include === customFilters.unreadCount) {
            filter.include = '';
        }

        if (Array.isArray(filter.include)) {
            isIncludeLastMessage = removeCustomMethodFromIncludeArray(filter.include, customFilters.lastMessage);
            isIncludeUnreadCount = removeCustomMethodFromIncludeArray(filter.include, customFilters.unreadCount);
        }

        let Chat = this.getModel('chat');
        async.auto({
            chats: (callback) => {
                Chat.find(filter, callback);
            },
            unreadMessages: ['chats', (results, callback) => {
                if (!isIncludeUnreadCount) return callback(null, []);

                let chatsIds = results.chats.map(chat => chat.id);
                findUnreadMessages(Chat, chatsIds, currentUserId, callback);
            }],
            lastMessages: ['chats', (results, callback) => {
                if (!isIncludeLastMessage) return callback(null, []);

                let chatsIds = results.chats.map(chat => chat.id);
                findLastMessages(Chat, chatsIds, callback);
            }],
            formattedResults: ['chats', 'unreadMessages', 'lastMessages', (results, callback) => {
                let chats = results.chats.slice();

                if (isIncludeLastMessage) {
                    chats = addLastMessagesToResult(chats, results.lastMessages);
                }

                if (isIncludeUnreadCount) {
                    chats = addUnreadCountToResult(chats, results.unreadMessages);
                }
                callback(null, chats);
            }]
        }, (err, results) => {
            if (err) {
                this.logWarn(fnName, err);
                return callback(err);
            }
            let data = results.formattedResults || [];
            this.logSuccess(fnName, data);
            callback(null, data);
        });
    }
}

/**
 * @param {Object} Chat
 * @param {Array.<string>} chatsIds
 * @param {String} userId
 * @param {Function} callback
 */
function findUnreadMessages(Chat, chatsIds, userId, callback) {
    Chat.getDataSource().connector.connect((err, db) => {
        if (err) {
            return callback(err);
        }

        let collection = db.collection('message');
        collection.aggregate([
            { $match: { chatId: { $in: chatsIds }, isRead: false, receiverId: userId } },
            {
                $group: {
                    _id: '$chatId',
                    count: { $sum: 1 }
                }
            }
        ], (err, result) => callback(err, groupBy('_id', result || [])));
    });
}

/**
 * @param {Object} Chat
 * @param {Array.<string>} chatsIds
 * @param {Function} callback
 */
function findLastMessages(Chat, chatsIds, callback) {
    Chat.getDataSource().connector.connect((err, db) => {
        if (err) {
            return callback(err);
        }

        let collection = db.collection('message');
        collection.aggregate([
            { $match: { chatId: { $in: chatsIds } } },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: '$chatId',
                    createdAt: { $first: '$createdAt' },
                    messageId: { $first: '$_id' },
                    text: { $first: '$text' }
                }
            }
        ], (err, result) => callback(err, groupBy('_id', result || [])));
    });
}

/**
 * @param {Array} array
 * @param {String} customMethod
 */
function removeCustomMethodFromIncludeArray(array, customMethod) {
    let index = array.findIndex((item) => item === customMethod);
    if (index !== -1) {
        array.splice(index, 1);
        return true;
    }
    return false;
}

/**
 * @param {string} property
 * @param {Array} array
 * @returns {*}
 */
function groupBy(property, array) {
    property = property || 'id';
    return array.reduce((memo, item) => {
        let key = item[property];
        memo[key] = item;
        return memo;
    }, {});
}

/**
 * @param {Array} chats
 * @param {*} lastMessages
 */
function addLastMessagesToResult(chats, lastMessages) {
    return chats.map(chat => {
        let message = lastMessages[chat.id];
        if (message) {
            chat.lastMessage = {
                id: message.messageId,
                text: message.text,
                createdAt: message.createdAt
            };
        }
        return chat;
    });
}

/**
 * @param {Array} chats
 * @param {*} unreadMessages
 */
function addUnreadCountToResult(chats, unreadMessages) {
    return chats.map(chat => {
        let unread = unreadMessages[chat.id];
        chat.unreadCount = unread ? unread.count : 0;
        return chat;
    });
}

module.exports = ChatEndpoint;