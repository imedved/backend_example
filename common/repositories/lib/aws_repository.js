'use strict';

let ConfigurationError = require('../../errors/configuration_error');

class AWSRepository {

    /**
     * @param {*} awsClient
     * @param {*} s3StreamClient
     * @param {{ s3Key, s3Secret, s3Bucket }} config
     */
    constructor(awsClient, s3StreamClient, config) {
        if (!config.s3Key || !config.s3Secret || !config.s3Bucket) throw new ConfigurationError('AWS S3 configuration');

        this._awsClient = awsClient;
        this._s3Key = config.s3Key;
        this._s3Secret = config.s3Secret;
        this._s3Bucket = config.s3Bucket;
        this._s3Client = new this._awsClient.S3({
            accessKeyId: this._s3Key,
            secretAccessKey: this._s3Secret
        });
        this._s3Stream = s3StreamClient(this._s3Client);
    }

    /**
     * @param {buffer} file
     * @param {string} filename
     * @param {string} userId
     * @param {function} callback
     */
    uploadImage(file, filename, userId, callback) {
        var upload = this._s3Stream.upload({
            Bucket: this._s3Bucket,
            Key: `${userId}/${filename}`,
            ACL: 'public-read'
        });
        upload.maxPartSize(5242880); // 5 MB
        upload.concurrentParts(5);
        upload.on('error', callback);
        upload.on('uploaded', (details) => {
            callback(null, details)
        });
        file.pipe(upload);
    }

    /**
     * @param {string} fileId
     * @param {function} callback
     */
    deleteImage(fileId, callback) {
        var params = {
            Bucket: this._s3Bucket,
            Key: fileId
        };
        this._s3Client.deleteObject(params, (err, data) => {
            if (err) return callback(err);
            callback(null, data);
        });
    }
}

module.exports = AWSRepository;