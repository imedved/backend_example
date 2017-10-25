'use strict';

module.exports = {
    env: process.env.CIRCLE_APP_ENV || 'dev',
    logLevel: process.env.CIRCLE_APP_LOG_LEVEL || 'DEBUG',

    sessionSecret: process.env.CIRCLE_APP_SESSION_SECRET || 'dev',
    sessionMaxAge: toNumber(process.env.CIRCLE_APP_SESSION_MAX_AGE) || 60000,
    cacheTtl: toNumber(process.env.CIRCLE_APP_CACHE_TTL) || 10, // sec
    memcachedServers: process.env.CIRCLE_MEMCACHED_SERVERS || 'localhost:11211',

    clientID: process.env.CIRCLE_FACEBOOK_CLIENT_ID,
    clientSecret: process.env.CIRCLE_FACEBOOK_CLIENT_SECRET,

    accessTokenTtlValue: toNumber(process.env.CIRCLE_ACCESS_TOKEN_TTL_VALUE) || 1,
    accessTokenTtlType: process.env.CIRCLE_ACCESS_TOKEN_TTL_TYPE || 'hour',

    relationUpdatePeriodValue: toNumber(process.env.CIRCLE_RELATION_UPDATE_PERIOD_VALUE) || 1,
    relationUpdatePeriodType: process.env.CIRCLE_RELATION_UPDATE_PERIOD_TYPE || 'hour',

    s3Key: process.env.CIRCLE_S3_KEY,
    s3Secret: process.env.CIRCLE_S3_SECRET,
    s3Bucket: process.env.CIRCLE_S3_BUCKET,

    cdnRoute: process.env.CIRCLE_CDN_ROUTE
};

function toNumber(str) {
    try {
        let res = parseInt(str);
        return isNaN(res) ? 0 : res;
    } catch (e) {
        return 0;
    }
}
