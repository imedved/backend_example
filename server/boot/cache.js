'use strict';

let log4js = require('../../common/utils').log4js;

module.exports = (app) => {

    let client = app.cacheClient;
    let ttl = app.get('cacheTtl');
    let logger = log4js.fork('Cache', app.get('logLevel'));

    app.remotes().before('*.*', (ctx, next) => {
        let method = ctx.methodString;
        if (ctx.req.method === 'GET') {
            let key = createKey(ctx);
            if (!key.value) {
                logger.error(`CREATE-KEY, on method: ${method}, error: ${key.error}.`);
                return next();
            }

            client.get(key.value, (err, result) => {
                if (err) {
                    logger.error(`GET, on method: ${method}, error: ${err}.`);
                    return next();
                }
                let data = parseResult(result);
                if (data) {
                    logger.debug(`GET, on method: ${method}, success: ${data}.`);
                    return ctx.res.status(ctx.res.statusCode).send(data);
                }
                next();
            });
        } else {
            next();
        }
    });

    app.remotes().after('*.*', (ctx, next) => {
        let method = ctx.methodString;
        if (ctx.req.method === 'GET') {
            let key = createKey(ctx);
            if (!key.value) {
                logger.error(`CREATE-KEY, on method: ${method}, error: ${key.error}.`);
                return next();
            }

            client.set(key.value, JSON.stringify(ctx.result), ttl, (err) => {
                if (err) {
                    logger.error(`SET, on method: ${method}, error: ${err}.`);
                }
                logger.debug(`SET, on method: ${method}, success.`);
                next();
            });
        } else {
            next();
        }
    });
};

/**
 * @param {*} ctx
 * @returns {{ value, error }}
 */
function createKey(ctx) {
    try {
        let key = ctx.methodString + ctx.req.url + JSON.stringify(ctx.req.remotingContext.args);
        return { value: key };
    }
    catch (e) {
        return { value: undefined, error: e };
    }
}

/**
 * @param {string} str
 * @returns {null}
 */
function parseResult(str) {
    try {
        return JSON.parse(str);
    } catch (e) {
        return null;
    }
}
