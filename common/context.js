'use strict';

class AppContext {

    /**
     * @param {*} app
     * @param {*} logger
     */
    constructor(app, logger) {
        this._app = app;
        this._logger = logger;
    }

    /**
     * @param {string} collectionName
     * @param {function} callback
     */
    getCollection(collectionName, callback) {
        let Model = this.getModel(collectionName);
        Model.getDataSource().connector.connect((err, db) => {
            if (err) {
                return callback(err);
            }
            callback(null, db.collection(collectionName));
        });
    }

    /**
     * @param {string} modelName
     * @returns {*}
     */
    getModel(modelName) {
        return this._app.models[modelName];
    }

    /**
     * @returns {*}
     */
    getContext() {
        return this._app.loopback.getCurrentContext();
    }

    /**
     * @returns {string}
     */
    getCurrentUserId() {
        let tokens = this.getFromContext('tokens') || {};
        return tokens.userId;
    }

    /**
     * @param {string} key
     */
    getFromContext(key) {
        return this.getContext().get(key);
    }

    /**
     * @returns {string}
     */
    getCurrentUserRole() {
        let tokens = this.getFromContext('tokens') || {};
        return tokens.role;
    }

    /**
     * @param {string} fnName
     * @param {*} data
     */
    logSuccess(fnName, data) {
        let currentUserId = this.getCurrentUserId();
        this._logger.debug(`${fnName}, success: ${JSON.stringify(data)} - userId: ${currentUserId}.`);
    }

    /**
     * @param {string} fnName
     * @param {*} err
     */
    logWarn(fnName, err) {
        let currentUserId = this.getCurrentUserId();
        this._logger.debug(`${fnName}, warning: ${JSON.stringify(err)} - userId: ${currentUserId}.`);
    }
}

module.exports = AppContext;