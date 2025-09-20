export interface RateLimitConfig {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
    burstSize?: number;
}
export interface QuotaConfig {
    maxRequestsPerHour: number;
    maxRequestsPerDay: number;
    maxConcurrentRequests: number;
}
export interface RateLimitInfo {
    remaining: number;
    reset: number;
    limit: number;
    retryAfter?: number;
}
export interface QuotaInfo {
    remaining: number;
    limit: number;
    reset: number;
    used: number;
}
export declare class RateLimiter {
    private static instance;
    private requestTimestamps;
    private hourlyRequests;
    private dailyRequests;
    private lastHourReset;
    private lastDayReset;
    private quotaUsed;
    private quotaLastReset;
    private activeRequests;
    private requestQueue;
    private rateConfig;
    private quotaConfig;
    private onRateLimitExceeded?;
    private onQuotaExceeded?;
    constructor(rateConfig?: RateLimitConfig, quotaConfig?: QuotaConfig);
    static getInstance(): RateLimiter;
    setRateLimitCallback(callback: (info: RateLimitInfo) => void): void;
    setQuotaCallback(callback: (info: QuotaInfo) => void): void;
    checkRateLimit(): Promise<RateLimitInfo>;
    recordRequest(): Promise<void>;
    completeRequest(): Promise<void>;
    executeWithRateLimit<T>(operation: () => Promise<T>, priority?: number): Promise<T>;
    private addToQueue;
    private processQueue;
    getRateLimitInfo(): RateLimitInfo;
    getQuotaInfo(): QuotaInfo;
    getStats(): {
        activeRequests: number;
        queuedRequests: number;
        minuteRequests: number;
        hourlyRequests: number;
        dailyRequests: number;
        quotaUsed: number;
    };
    reset(): void;
    private cleanupOldRequests;
    private checkQuotaReset;
    private startCleanupInterval;
}
export declare const rateLimiter: RateLimiter;
export declare function withRateLimit(priority?: number): (target: any, propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
export declare function withRateLimiting<T>(operation: () => Promise<T>, priority?: number): Promise<T>;
//# sourceMappingURL=rate-limiter.d.ts.map