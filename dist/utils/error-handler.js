"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationError = exports.errorHandler = exports.ErrorHandler = exports.ErrorType = void 0;
exports.withRetry = withRetry;
exports.withErrorHandling = withErrorHandling;
const axios_1 = require("axios");
const config_1 = require("../config/config");
var ErrorType;
(function (ErrorType) {
    ErrorType["NETWORK_ERROR"] = "NETWORK_ERROR";
    ErrorType["API_ERROR"] = "API_ERROR";
    ErrorType["RATE_LIMIT_ERROR"] = "RATE_LIMIT_ERROR";
    ErrorType["AUTHENTICATION_ERROR"] = "AUTHENTICATION_ERROR";
    ErrorType["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorType["TIMEOUT_ERROR"] = "TIMEOUT_ERROR";
    ErrorType["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
})(ErrorType || (exports.ErrorType = ErrorType = {}));
class ErrorHandler {
    constructor() {
        this.errorCallbacks = new Map();
        this.initializeErrorTypes();
    }
    static getInstance() {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }
    initializeErrorTypes() {
        Object.values(ErrorType).forEach(type => {
            this.errorCallbacks.set(type, []);
        });
    }
    onError(errorType, callback) {
        const callbacks = this.errorCallbacks.get(errorType) || [];
        callbacks.push(callback);
        this.errorCallbacks.set(errorType, callbacks);
    }
    offError(errorType, callback) {
        const callbacks = this.errorCallbacks.get(errorType) || [];
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
            this.errorCallbacks.set(errorType, callbacks);
        }
    }
    createError(error, context) {
        const appError = {
            type: ErrorType.UNKNOWN_ERROR,
            message: 'Unknown error occurred',
            timestamp: new Date(),
            retryable: false,
        };
        if (error instanceof Error) {
            appError.originalError = error;
            appError.message = error.message;
        }
        if (typeof error === 'string') {
            appError.message = error;
        }
        if (error instanceof axios_1.AxiosError) {
            this.handleAxiosError(appError, error);
        }
        if (context) {
            appError.details = { ...appError.details, ...context };
        }
        return appError;
    }
    handleAxiosError(appError, axiosError) {
        const status = axiosError.response?.status;
        const data = axiosError.response?.data;
        switch (status) {
            case 401:
                appError.type = ErrorType.AUTHENTICATION_ERROR;
                appError.message = 'Authentication failed. Please check your API token.';
                appError.retryable = false;
                break;
            case 429:
                appError.type = ErrorType.RATE_LIMIT_ERROR;
                appError.message = 'Rate limit exceeded. Please try again later.';
                appError.retryable = true;
                break;
            case 400:
                appError.type = ErrorType.VALIDATION_ERROR;
                appError.message = data?.error || 'Invalid request parameters';
                appError.retryable = false;
                break;
            case 403:
                appError.type = ErrorType.AUTHENTICATION_ERROR;
                appError.message = 'Access denied. Insufficient permissions.';
                appError.retryable = false;
                break;
            case 404:
                appError.type = ErrorType.API_ERROR;
                appError.message = 'Resource not found';
                appError.retryable = false;
                break;
            case 500:
            case 502:
            case 503:
            case 504:
                appError.type = ErrorType.API_ERROR;
                appError.message = 'Server error occurred';
                appError.retryable = true;
                break;
            case -1:
            case undefined:
                appError.type = ErrorType.NETWORK_ERROR;
                appError.message = 'Network connection failed';
                appError.retryable = true;
                break;
            case 408:
                appError.type = ErrorType.TIMEOUT_ERROR;
                appError.message = 'Request timeout';
                appError.retryable = true;
                break;
            default:
                appError.type = ErrorType.API_ERROR;
                appError.message = data?.error || `API error: ${status}`;
                appError.retryable = status >= 500;
        }
        if (data?.error_code) {
            appError.code = data.error_code;
        }
        if (data?.error_extra) {
            appError.details = { ...appError.details, ...data.error_extra };
        }
    }
    async handleErrorWithRetry(operation, maxRetries = config_1.config.taskProcessing.maxRetries, retryDelayMs = config_1.config.taskProcessing.retryDelayMs, context) {
        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                const appError = this.createError(error, context);
                lastError = appError;
                if (!appError.retryable) {
                    this.emitError(appError);
                    throw appError;
                }
                if (attempt === maxRetries) {
                    this.emitError(appError);
                    throw appError;
                }
                const delay = retryDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
                console.warn(`Attempt ${attempt + 1} failed. Retrying in ${delay}ms...`, appError.message);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        throw lastError;
    }
    emitError(error) {
        const callbacks = this.errorCallbacks.get(error.type) || [];
        callbacks.forEach(callback => {
            try {
                callback(error);
            }
            catch (callbackError) {
                console.error('Error in error callback:', callbackError);
            }
        });
        if (error.type !== ErrorType.UNKNOWN_ERROR) {
            const unknownCallbacks = this.errorCallbacks.get(ErrorType.UNKNOWN_ERROR) || [];
            unknownCallbacks.forEach(callback => {
                try {
                    callback(error);
                }
                catch (callbackError) {
                    console.error('Error in unknown error callback:', callbackError);
                }
            });
        }
    }
    isRetryable(error) {
        const appError = this.createError(error);
        return appError.retryable;
    }
    getUserFriendlyMessage(error) {
        const appError = this.createError(error);
        switch (appError.type) {
            case ErrorType.AUTHENTICATION_ERROR:
                return 'Oturumunuz süresi dolmuş. Lütfen tekrar giriş yapın.';
            case ErrorType.RATE_LIMIT_ERROR:
                return 'İstek limitiniz aşıldı. Lütfen bir süre bekleyip tekrar deneyin.';
            case ErrorType.NETWORK_ERROR:
                return 'İnternet bağlantınızda bir sorun var. Lütfen bağlantınızı kontrol edin.';
            case ErrorType.TIMEOUT_ERROR:
                return 'İşlem zaman aşımına uğradı. Lütfen tekrar deneyin.';
            case ErrorType.VALIDATION_ERROR:
                return 'Girdilerinizde bir hata var. Lütfen bilgilerinizi kontrol edin.';
            case ErrorType.API_ERROR:
                return 'Sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin.';
            default:
                return 'Beklenmedik bir hata oluştu. Lütfen tekrar deneyin.';
        }
    }
    logError(error, context) {
        const appError = this.createError(error, context);
        const logData = {
            timestamp: appError.timestamp.toISOString(),
            type: appError.type,
            message: appError.message,
            code: appError.code,
            retryable: appError.retryable,
            context: appError.details,
            stack: appError.originalError?.stack,
        };
        console.error('Application Error:', logData);
    }
    createCustomError(type, message, code, details, retryable = false) {
        return {
            type,
            message,
            code,
            details,
            timestamp: new Date(),
            retryable,
        };
    }
}
exports.ErrorHandler = ErrorHandler;
exports.errorHandler = ErrorHandler.getInstance();
function withRetry(maxRetries, retryDelayMs) {
    return function (target, propertyName, descriptor) {
        const method = descriptor.value;
        descriptor.value = async function (...args) {
            const maxRetriesValue = maxRetries ?? config_1.config.taskProcessing.maxRetries;
            const retryDelayMsValue = retryDelayMs ?? config_1.config.taskProcessing.retryDelayMs;
            return exports.errorHandler.handleErrorWithRetry(() => method.apply(this, args), maxRetriesValue, retryDelayMsValue, { method: propertyName, class: target.constructor.name });
        };
        return descriptor;
    };
}
class ApplicationError extends Error {
    constructor(message, type, code, retryable = false, details) {
        super(message);
        this.type = type;
        this.code = code;
        this.retryable = retryable;
        this.details = details;
        this.name = 'ApplicationError';
    }
}
exports.ApplicationError = ApplicationError;
async function withErrorHandling(operation, context) {
    try {
        return await operation();
    }
    catch (error) {
        const appError = exports.errorHandler.createError(error, context);
        exports.errorHandler.emitError(appError);
        throw appError;
    }
}
//# sourceMappingURL=error-handler.js.map