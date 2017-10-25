'use strict';

const InternalServerError = require('../../errors/internal_server_error');
const AppContext = require('./../../context');

class ApartmentEndpoint extends AppContext {

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

        let Apartment = this.getModel('apartment');
        Apartment.destroyAll({ userId: currentUserId }, (err, results) => {
            if (err) {
                this.logWarn(fnName, err);
                return callback(err);
            }
            this.logSuccess(fnName, results);
            callback(null, results);
        });
    }
}

module.exports = ApartmentEndpoint;