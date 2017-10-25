'use strict';

const InternalServerError = require('../../errors/internal_server_error');
const BadRequestError = require('../../errors/bad_request_error');
const AppContext = require('./../../context');

class MessageEndpoint extends AppContext {

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

        let Model = this.getModel('message');
        let where = { or: [{ senderId: currentUserId }, { receiverId: currentUserId }] };
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
     * @param {*} body
     * @param {Function} callback
     */
    bulkUpdateRead(body, callback) {
        let fnName = 'bulkUpdateRead';
        let data = body.bulk;
        if (!data) {
            let err = new BadRequestError('Bulk must be defined.');
            this.logWarn(fnName, err);
            return callback(err);
        }
        if (!(data instanceof Array)) {
            let err = new BadRequestError('Bulk must be array of String.');
            this.logWarn(fnName, err);
            return callback(err);
        }

        let Message = this.getModel('message');
        let where = { id: { inq: data } };
        Message.updateAll(where, { isRead: true }, (err, data) => {
            if (err) {
                this.logWarn(fnName, err);
                return callback(err);
            }
            this.logSuccess(fnName, data);
            callback(null, data.count);
        });
    }
}

module.exports = MessageEndpoint;
