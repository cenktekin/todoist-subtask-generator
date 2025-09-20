"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.validateConfig = validateConfig;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    todoist: {
        apiToken: process.env.TODOIST_API_TOKEN || '',
        baseUrl: 'https://api.todoist.com/rest/v1',
        rateLimit: {
            requestsPerMinute: 60,
            requestsPerHour: 1000,
        },
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1000'),
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
    },
    app: {
        port: parseInt(process.env.PORT || '3000'),
        environment: process.env.NODE_ENV || 'development',
        logLevel: process.env.LOG_LEVEL || 'info',
    },
    database: {
        path: process.env.DB_PATH || './data/todoist.db',
    },
    taskProcessing: {
        maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
        retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '1000'),
        batchSize: parseInt(process.env.BATCH_SIZE || '10'),
    },
    subtaskGeneration: {
        maxSubtasks: parseInt(process.env.MAX_SUBTASKS || '10'),
        minSubtaskLength: parseInt(process.env.MIN_SUBTASK_LENGTH || '5'),
        maxSubtaskLength: parseInt(process.env.MAX_SUBTASK_LENGTH || '100'),
    },
    date: {
        timezone: process.env.TIMEZONE || 'Europe/Istanbul',
        dateFormat: 'YYYY-MM-DD',
        timeFormat: 'HH:mm',
    },
};
function validateConfig() {
    const errors = [];
    if (!exports.config.todoist.apiToken) {
        errors.push('TODOIST_API_TOKEN is required');
    }
    if (!exports.config.openai.apiKey) {
        errors.push('OPENAI_API_KEY is required');
    }
    if (errors.length > 0) {
        throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
}
//# sourceMappingURL=config.js.map