"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiter = exports.RateLimiter = void 0;
exports.withRateLimit = withRateLimit;
exports.withRateLimiting = withRateLimiting;
const config_1 = require("../config/config");
class RateLimiter {
    constructor(rateConfig = config_1.config.todoist.rateLimit, quotaConfig = {
        maxRequestsPerHour: 1000,
        maxRequestsPerDay: 10000,
        maxConcurrentRequests: 10,
    }) {
        this.requestTimestamps = [];
        this.hourlyRequests = 0;
        this.dailyRequests = 0;
        this.lastHourReset = Date.now();
        this.lastDayReset = Date.now();
        this.quotaUsed = 0;
        this.quotaLastReset = Date.now();
        this.activeRequests = 0;
        this.requestQueue = [];
        this.rateConfig = rateConfig;
        this.quotaConfig = quotaConfig;
        this.startCleanupInterval();
    }
    static getInstance() {
        if (!RateLimiter.instance) {
            RateLimiter.instance = new RateLimiter();
        }
        return RateLimiter.instance;
    }
    setRateLimitCallback(callback) {
        this.onRateLimitExceeded = callback;
    }
    setQuotaCallback(callback) {
        this.onQuotaExceeded = callback;
    }
    async checkRateLimit() {
        this.cleanupOldRequests();
        this.checkQuotaReset();
        const now = Date.now();
        const currentMinute = Math.floor(now / 60000);
        const currentHour = Math.floor(now / 3600000);
        const currentDay = Math.floor(now / 86400000);
        const minuteRequests = this.requestTimestamps.filter(timestamp => Math.floor(timestamp / 60000) === currentMinute).length;
        if (minuteRequests >= this.rateConfig.requestsPerMinute) {
            const resetTime = (currentMinute + 1) * 60000;
            const retryAfter = resetTime - now;
            const info = {
                remaining: 0,
                reset: resetTime,
                limit: this.rateConfig.requestsPerMinute,
                retryAfter,
            };
            this.onRateLimitExceeded?.(info);
            throw new Error(`Rate limit exceeded. Retry after ${retryAfter}ms`);
        }
        if (currentHour !== this.lastHourReset) {
            this.hourlyRequests = 0;
            this.lastHourReset = currentHour;
        }
        if (this.hourlyRequests >= this.rateConfig.requestsPerHour) {
            const resetTime = (currentHour + 1) * 3600000;
            const retryAfter = resetTime - now;
            const info = {
                remaining: 0,
                reset: resetTime,
                limit: this.rateConfig.requestsPerHour,
                retryAfter,
            };
            this.onRateLimitExceeded?.(info);
            throw new Error(`Hourly rate limit exceeded. Retry after ${retryAfter}ms`);
        }
        if (currentDay !== this.lastDayReset) {
            this.dailyRequests = 0;
            this.lastDayReset = currentDay;
        }
        if (this.dailyRequests >= this.rateConfig.requestsPerDay) {
            const resetTime = (currentDay + 1) * 86400000;
            const retryAfter = resetTime - now;
            const info = {
                remaining: 0,
                reset: resetTime,
                limit: this.rateConfig.requestsPerDay,
                retryAfter,
            };
            this.onRateLimitExceeded?.(info);
            throw new Error(`Daily rate limit exceeded. Retry after ${retryAfter}ms`);
        }
        if (this.quotaUsed >= this.quotaConfig.maxRequestsPerHour) {
            const resetTime = this.quotaLastReset + 3600000;
            const retryAfter = resetTime - now;
            const info = {
                remaining: 0,
                limit: this.quotaConfig.maxRequestsPerHour,
                reset: resetTime,
                used: this.quotaUsed,
            };
            this.onQuotaExceeded?.(info);
            throw new Error(`Quota exceeded. Retry after ${retryAfter}ms`);
        }
        if (this.activeRequests >= this.quotaConfig.maxConcurrentRequests) {
            throw new Error('Maximum concurrent requests reached');
        }
        return {
            remaining: this.rateConfig.requestsPerMinute - minuteRequests,
            reset: (currentMinute + 1) * 60000,
            limit: this.rateConfig.requestsPerMinute,
        };
    }
    async recordRequest() {
        const now = Date.now();
        this.requestTimestamps.push(now);
        this.hourlyRequests++;
        this.dailyRequests++;
        this.quotaUsed++;
        this.activeRequests++;
        this.requestTimestamps = this.requestTimestamps.filter(timestamp => now - timestamp < 3600000);
    }
    async completeRequest() {
        this.activeRequests--;
        this.processQueue();
    }
    async executeWithRateLimit(operation, priority = 0) {
        return new Promise(async (resolve, reject) => {
            try {
                await this.checkRateLimit();
                await this.recordRequest();
                try {
                    const result = await operation();
                    await this.completeRequest();
                    resolve(result);
                }
                catch (error) {
                    await this.completeRequest();
                    reject(error);
                }
            }
            catch (error) {
                if (error instanceof Error && (error.message.includes('Rate limit exceeded') ||
                    error.message.includes('Quota exceeded') ||
                    error.message.includes('Maximum concurrent requests'))) {
                    this.addToQueue(operation, priority, resolve, reject);
                }
                else {
                    reject(error);
                }
            }
        });
    }
    addToQueue(operation, priority, resolve, reject) {
        const queueItem = { operation, priority, resolve, reject };
        let insertIndex = 0;
        for (let i = 0; i < this.requestQueue.length; i++) {
            if (this.requestQueue[i].priority <= priority) {
                insertIndex = i;
                break;
            }
            insertIndex = i + 1;
        }
        this.requestQueue.splice(insertIndex, 0, queueItem);
        this.processQueue();
    }
    async processQueue() {
        if (this.requestQueue.length === 0 || this.activeRequests >= this.quotaConfig.maxConcurrentRequests) {
            return;
        }
        const nextItem = this.requestQueue.shift();
        if (!nextItem)
            return;
        try {
            await this.checkRateLimit();
            await this.recordRequest();
            try {
                const result = await nextItem.operation();
                await this.completeRequest();
                nextItem.resolve(result);
            }
            catch (error) {
                await this.completeRequest();
                nextItem.reject(error);
            }
        }
        catch (error) {
            if (error instanceof Error && (error.message.includes('Rate limit exceeded') ||
                error.message.includes('Quota exceeded') ||
                error.message.includes('Maximum concurrent requests'))) {
                this.requestQueue.unshift(nextItem);
            }
            else {
                nextItem.reject(error);
            }
        }
        setImmediate(() => this.processQueue());
    }
    getRateLimitInfo() {
        const now = Date.now();
        const currentMinute = Math.floor(now / 60000);
        const minuteRequests = this.requestTimestamps.filter(timestamp => Math.floor(timestamp / 60000) === currentMinute).length;
        return {
            remaining: Math.max(0, this.rateConfig.requestsPerMinute - minuteRequests),
            reset: (currentMinute + 1) * 60000,
            limit: this.rateConfig.requestsPerMinute,
        };
    }
    getQuotaInfo() {
        const now = Date.now();
        const currentHour = Math.floor(now / 3600000);
        if (currentHour !== this.quotaLastReset) {
            this.quotaUsed = 0;
            this.quotaLastReset = currentHour;
        }
        return {
            remaining: Math.max(0, this.quotaConfig.maxRequestsPerHour - this.quotaUsed),
            limit: this.quotaConfig.maxRequestsPerHour,
            reset: (this.quotaLastReset + 1) * 3600000,
            used: this.quotaUsed,
        };
    }
    getStats() {
        const now = Date.now();
        const currentMinute = Math.floor(now / 60000);
        const minuteRequests = this.requestTimestamps.filter(timestamp => Math.floor(timestamp / 60000) === currentMinute).length;
        return {
            activeRequests: this.activeRequests,
            queuedRequests: this.requestQueue.length,
            minuteRequests,
            hourlyRequests: this.hourlyRequests,
            dailyRequests: this.dailyRequests,
            quotaUsed: this.quotaUsed,
        };
    }
    reset() {
        this.requestTimestamps = [];
        this.hourlyRequests = 0;
        this.dailyRequests = 0;
        this.quotaUsed = 0;
        this.activeRequests = 0;
        this.requestQueue = [];
        this.lastHourReset = Date.now();
        this.lastDayReset = Date.now();
        this.quotaLastReset = Date.now();
    }
    cleanupOldRequests() {
        const now = Date.now();
        const oneHourAgo = now - 3600000;
        this.requestTimestamps = this.requestTimestamps.filter(timestamp => timestamp > oneHourAgo);
    }
    checkQuotaReset() {
        const now = Date.now();
        const oneHourAgo = now - 3600000;
        if (this.quotaLastReset < oneHourAgo) {
            this.quotaUsed = 0;
            this.quotaLastReset = now;
        }
    }
    startCleanupInterval() {
        setInterval(() => {
            this.cleanupOldRequests();
            this.checkQuotaReset();
        }, 60000);
    }
}
exports.RateLimiter = RateLimiter;
exports.rateLimiter = RateLimiter.getInstance();
function withRateLimit(priority = 0) {
    return function (target, propertyName, descriptor) {
        const method = descriptor.value;
        descriptor.value = async function (...args) {
            return exports.rateLimiter.executeWithRateLimit(() => method.apply(this, args), priority);
        };
        return descriptor;
    };
}
async function withRateLimiting(operation, priority = 0) {
    return exports.rateLimiter.executeWithRateLimit(operation, priority);
}
//# sourceMappingURL=rate-limiter.js.map