'use strict';

const InternalServerError = require('../../errors/internal_server_error');
const AppContext = require('./../../context');

class ImageEndpoint extends AppContext {

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

        let Model = this.getModel('image');
        Model.destroyAll({ userId: currentUserId }, (err, results) => {
            if (err) {
                this.logWarn(fnName, err);
                return callback(err);
            }
            this.logSuccess(fnName, results);
            callback(null, results);
            //TODO: also need to remove images from S3
        });
    }

    /**
     * @param {number} width
     * @param {number} height
     * @param {number} order
     * @param {string} avatarId
     * @param {string} apartmentId
     * @param {string} messageId
     * @param {string} newsfeedId
     * @param {function} callback
     */
    upload(width, height, order, avatarId, apartmentId, messageId, newsfeedId, callback) {
        let fnName = 'upload';

        let currentUserId = this.getCurrentUserId();
        let imageData = this.getFromContext('image');

        imageData.userId = currentUserId;
        imageData.avatarId = avatarId ? currentUserId : '';
        imageData.apartmentId = apartmentId || '';
        imageData.messageId = messageId || '';
        imageData.newsfeedId = newsfeedId || '';

        imageData.width = width || 0;
        imageData.height = height || 0;
        imageData.order = order || 0;
        imageData.created = new Date();
        imageData.modified = new Date();

        let Image = this.getModel('image');
        Image.create(imageData, (err, results) => {
            if (err) {
                this.logWarn(fnName, err);
                return callback(err);
            }
            this.logSuccess(fnName, results);
            callback(null, results);
        });
    }
}

module.exports = ImageEndpoint;