'use strict';

let BadRequestError = require('../../errors/bad_request_error');

class FileManager {

    /**
     * @param {*} app
     * @param {AWSRepository} awsRepository
     * @param {*} uuid
     * @param {*} filter
     * @param {*} logger
     * @param {{ cdnRoute }} options
     */
    constructor(app, awsRepository, uuid, filter, logger, options) {
        this._app = app;
        this._aws = awsRepository;
        this._uuid = uuid;
        this._filter = filter;
        this._logger = logger;
        this._options = options;
    }

    /**
     * @param {*} context
     * @param {{exclude, include}=} options
     * @returns {function}
     */
    parseImage(context, options) {
        let method = context.methodString;
        return this._filter(method, options, next => {
            if (!context.req.busboy) return next(new BadRequestError('No file.'));

            let isFileFieldExists = false;
            context.req.busboy.on('file', (fieldname, file, filename/*, encoding, mimetype*/) => {
                isFileFieldExists = true;

                if (!filename) {
                    file.resume();
                    return next(new BadRequestError('Not a file.'));
                }

                if (!this._isDataValid(context.req.query)) {
                    file.resume();
                    return next(new BadRequestError('Incorrect field value.'));
                }

                let fileId = this._createId(filename);
                let session = context.req.session;
                let userId = session.tokens.userId;

                this._aws.uploadImage(file, fileId, userId, (err, data) => {
                    if (err) {
                        file.resume();
                        return next(new BadRequestError(err.message));
                    }

                    const cndRoute = this._options.cdnRoute;
                    let ctx = this._app.loopback.getCurrentContext();
                    let imageData = {
                        url: `https://${cndRoute}/${data.Key}`,
                        bucket: data.Bucket,
                        fileId: data.Key,
                        ETag: data.ETag
                    };
                    ctx.set('image', imageData);
                    next();
                });
            });
            context.req.busboy.on('finish', () => {
                if (!isFileFieldExists) return next(new BadRequestError('No file.'))
            });
            context.req.pipe(context.req.busboy);
        });
    }

    deleteById(model) {
        let that = this;
        let originDelete = model.deleteById;
        return function (id, cb) {
            var args = arguments;
            model.findById(id, { fields: ['id', 'fileId'] }, (err, data)=> {
                if (err) return cb(new BadRequestError(err.message));
                if (!data || !data.fileId) return originDelete.apply(model, args);
                that._aws.deleteImage(data.fileId, (err/*, data*/) => {
                    if (err) return cb(new BadRequestError(err.message));
                    return originDelete.apply(model, args);
                });
            });
        };
    }

    /**
     * @param {string} filename
     * @returns {string}
     * @private
     */
    _createId(filename) {
        let fileExtension = filename.match(/\.[0-9a-z]+$/i);
        return this._uuid.v4() + (fileExtension);
    }

    /**
     * @param {*} query
     * @returns {boolean}
     * @private
     */
    _isDataValid(query) {
        let requiredFields = ['width', 'height', 'order'];
        return !requiredFields.some((field) => {
            let fieldValue = query[field];
            return !(/^[0-9]+$/.test(fieldValue));
        });
    }
}

module.exports = FileManager;
