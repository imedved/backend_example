/**
 * @param {string} modelType
 * @param {string} modelId
 * @constructor
 */
function ModelNotFoundError(modelType, modelId) {
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.statusCode = this.status = 404;
    this.code = 'MODEL_NOT_FOUND';
    this.message = `Unknown "${modelType}" id "${modelId}".`;
}

require('util').inherits(ModelNotFoundError, Error);

module.exports = ModelNotFoundError;
