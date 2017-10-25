'use strict';

let AWS = require('aws-sdk');
let FB = require('fb');
let crypto = require('crypto');
let s3StreamClient = require('s3-upload-stream');

let app = require('../../server/server');

let AWSRepository = require('./../repositories/lib/aws_repository');
let FacebookRepository = require('./lib/facebook_repository');

module.exports = {
    facebook: new FacebookRepository(FB, crypto, {
        clientID: app.get('clientID'),
        clientSecret: app.get('clientSecret')
    }),
    aws: new AWSRepository(AWS, s3StreamClient, {
        s3Key: app.get('s3Key'),
        s3Secret: app.get('s3Secret'),
        s3Bucket: app.get('s3Bucket')
    })
};