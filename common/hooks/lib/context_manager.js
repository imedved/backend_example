'use strict';

const ROLE_ADMIN = 'ADMIN';
let AuthError = require('../../errors/auth_error');
let ModelNotFound = require('../../errors/model_not_found_error');
let AccessError = require('../../errors/access_error');
let AppContext = require('../../context');

class ContextManager extends AppContext {

    /**
     * @param {{ loopback, models }} app
     * @param {*} crypto
     * @param {Function} filter
     * @param {*} logger
     */
    constructor(app, crypto, filter, logger) {
        super(app, logger);
        this._crypto = crypto;
        this._filter = filter;
    }

    /**
     * @param {*} context
     * @param {{exclude, include}=} options
     * @returns {function}
     */
    verifyToken(context, options) {
        let fnName = 'verifyToken';
        let method = context.methodString;
        return this._filter(method, options, next => {
            let token = context.req.query.access_token;
            if (!token) {
                let message = 'Invalid access token.';
                this._logger.warn(`${method}, error: ${message} - token: ${token}`);
                return next(new AuthError(message));
            }

            let accessToken = this._crypto.decodeToken(token);
            if (!this._crypto.isTokenValid(accessToken)) {
                let message = 'Invalid access token.';
                this._logger.warn(`${method}, error: ${message} - token: ${token}`);
                return next(new AuthError(message));
            }

            let ctx = this.getContext();
            let session = context.req.session;
            if (session.tokens && session.tokens.accessToken.value === token) {
                ctx.set('tokens', session.tokens);
                return next();
            }

            let Token = this.getModel('token');
            Token.findOne({ where: { 'accessToken.value': token } }, (err, tokens) => {
                if (err) {
                    let message = 'Invalid access token.';
                    this._logger.error(`${method}, error: ${message} - token: ${token}`);
                    return next(new AuthError(message));
                }
                if (!tokens) {
                    let message = 'Invalid access token.';
                    this._logger.warn(`${method}, error: ${message} - token: ${token}`);
                    return next(new AuthError(message));
                }
                session['tokens'] = tokens;
                ctx.set('tokens', tokens);
                this._logger.debug(`${fnName}, message: token defined - token: ${token}`);
                next();
            });
        });
    }

    /**
     * @param {*} context
     * @param {{exclude, include}=} options
     * @returns {function}
     */
    cleanup(context, options) {
        let method = context.methodString;
        return this._filter(method, options, next => {
            let session = context.req.session;
            let ctx = this.getContext();
            ctx.set('tokens', undefined);
            session.destroy();
            next();
        });
    }

    /**
     * @param {*} context
     * @param {{exclude, include, userIdFields}=} options
     * @returns {function}
     */
    verifyPermissions(context, options) {
        let method = context.methodString;
        return this._filter(method, options, next => {
            if (this.getCurrentUserRole() === ROLE_ADMIN) return next();

            let currentUserId = this.getCurrentUserId();
            let fields = options.userIdFields || ['userId'];
            let instanceId = context.req.params.id;

            let modelName = this._getCurrentModelName(context);
            let model = this.getModel(modelName);

            model.findById(instanceId, (err, instance) => {
                if (err) {
                    return next(err);
                }
                if (!instance) {
                    let error = new ModelNotFound(modelName, instanceId);
                    return next(error);
                }
                let hasPermission = fields.find(field => instance[field] === currentUserId);

                if (!hasPermission) {
                    return next(new AccessError("Access denied."));
                }
                next();
            });
        });
    }

    /**
     * @param {*} context
     * @param {{exclude, include, userIdFields}=} options
     * @returns {*}
     */
    defineCurrentUser(context, options) {
        let fnName = 'defineCurrentUser';
        let method = context.methodString;
        return this._filter(method, options, next => {
            let session = context.req.session;
            let ctx = this.getContext();
            let currentUserId = this.getCurrentUserId();

            if (session.currentUser) {
                ctx.set('currentUser', session.currentUser);
                return next();
            }

            let User = this.getModel('user');
            User.findById(currentUserId, (err, result) => {
                if (err) {
                    this._logger.error(`${fnName}, error: ${err.message} - userId: ${currentUserId}`);
                    return next(err);
                }
                if (!result) {
                    this._logger.warn(`${fnName}, user not found - userId: ${currentUserId}`);
                    return next();
                }
                session['currentUser'] = result;
                ctx.set('currentUser', result);
                this._logger.debug(`${fnName}, user defined - userId: ${currentUserId}`);
                next();
            });
        });
    }

    /**
     * @param {*} context
     * @returns {string}
     * @private
     */
    _getCurrentModelName(context) {
        return context.method.sharedClass.name;
    }
}

module.exports = ContextManager;
