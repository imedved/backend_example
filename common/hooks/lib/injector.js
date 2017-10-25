'use strict';

class Injector {

    /**
     * @param {{ loopback }} app
     * @param {function} filter
     */
    constructor(app, filter) {
        this._app = app;
        this._filter = filter;
    }

    /**
     * @param {*} context
     * @param {{ include, exclude, injectField}=} options
     * @returns {*}
     */
    addUserId(context, options) {
        let method = context.methodString;
        return this._filter(method, options, next => {
            let ctx = this._app.loopback.getCurrentContext();
            let tokens = ctx.get('tokens');

            let field = options.injectField || 'userId';
            context.req.body[field] = tokens.userId;
            next();
        });
    }

    /**
     * @param {*} context
     * @param {{ include, exclude}=} options
     */
    addTimestampOnCreate(context, options) {
        let method = context.methodString;
        return this._filter(method, options, next => {
            let today = new Date();
            let req = context.req;
            req.body.created = today;
            req.body.modified = today;
            next();
        });
    }

    /**
     * @param {*} context
     * @param {{ include, exclude}=} options
     */
    addTimestampOnUpdate(context, options) {
        let method = context.methodString;
        return this._filter(method, options, next => {
            let today = new Date();
            let req = context.req;
            req.body.modified = today;
            next();
        });
    }

    /**
     * @param {*} context
     * @param {{ include, exclude, fields}=} options
     */
    removeFields(context, options) {
        let method = context.methodString;
        return this._filter(method, options, next => {
            let body = context.req.body;
            let fields = options.fields || [];
            fields.forEach(field => {
                if (body[field]) delete body[field];
            });
            next();
        });
    }
}

module.exports = Injector;