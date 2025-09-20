import { config } from '../config/config';
import { errorHandler, ErrorType } from './error-handler';

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

export class RateLimiter {
  private static instance: RateLimiter;
  
  // Rate tracking
  private requestTimestamps: number[] = [];
  private hourlyRequests: number = 0;
  private dailyRequests: number = 0;
  private lastHourReset: number = Date.now();
  private lastDayReset: number = Date.now();
  
  // Quota tracking
  private quotaUsed: number = 0;
  private quotaLastReset: number = Date.now();
  
  // Concurrent request tracking
  private activeRequests: number = 0;
  private requestQueue: Array<{ operation: () => Promise<any>; priority: number; resolve: (value: any) => void; reject: (reason?: any) => void }> = [];
  
  // Configuration
  private rateConfig: RateLimitConfig;
  private quotaConfig: QuotaConfig;
  
  // Callbacks
  private onRateLimitExceeded?: (info: RateLimitInfo) => void;
  private onQuotaExceeded?: (info: QuotaInfo) => void;

  constructor(
    rateConfig: RateLimitConfig = config.todoist.rateLimit,
    quotaConfig: QuotaConfig = {
      maxRequestsPerHour: 1000,
      maxRequestsPerDay: 10000,
      maxConcurrentRequests: 10,
    }
  ) {
    this.rateConfig = rateConfig;
    this.quotaConfig = quotaConfig;
    this.startCleanupInterval();
  }

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  // Set callbacks
  setRateLimitCallback(callback: (info: RateLimitInfo) => void): void {
    this.onRateLimitExceeded = callback;
  }

  setQuotaCallback(callback: (info: QuotaInfo) => void): void {
    this.onQuotaExceeded = callback;
  }

  // Check if request is allowed
  async checkRateLimit(): Promise<RateLimitInfo> {
    this.cleanupOldRequests();
    this.checkQuotaReset();
    
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000);
    const currentHour = Math.floor(now / 3600000);
    const currentDay = Math.floor(now / 86400000);

    // Check minute rate limit
    const minuteRequests = this.requestTimestamps.filter(
      timestamp => Math.floor(timestamp / 60000) === currentMinute
    ).length;

    if (minuteRequests >= this.rateConfig.requestsPerMinute) {
      const resetTime = (currentMinute + 1) * 60000;
      const retryAfter = resetTime - now;
      
      const info: RateLimitInfo = {
        remaining: 0,
        reset: resetTime,
        limit: this.rateConfig.requestsPerMinute,
        retryAfter,
      };

      this.onRateLimitExceeded?.(info);
      throw new Error(`Rate limit exceeded. Retry after ${retryAfter}ms`);
    }

    // Check hourly rate limit
    if (currentHour !== this.lastHourReset) {
      this.hourlyRequests = 0;
      this.lastHourReset = currentHour;
    }

    if (this.hourlyRequests >= this.rateConfig.requestsPerHour) {
      const resetTime = (currentHour + 1) * 3600000;
      const retryAfter = resetTime - now;
      
      const info: RateLimitInfo = {
        remaining: 0,
        reset: resetTime,
        limit: this.rateConfig.requestsPerHour,
        retryAfter,
      };

      this.onRateLimitExceeded?.(info);
      throw new Error(`Hourly rate limit exceeded. Retry after ${retryAfter}ms`);
    }

    // Check daily rate limit
    if (currentDay !== this.lastDayReset) {
      this.dailyRequests = 0;
      this.lastDayReset = currentDay;
    }

    if (this.dailyRequests >= this.rateConfig.requestsPerDay) {
      const resetTime = (currentDay + 1) * 86400000;
      const retryAfter = resetTime - now;
      
      const info: RateLimitInfo = {
        remaining: 0,
        reset: resetTime,
        limit: this.rateConfig.requestsPerDay,
        retryAfter,
      };

      this.onRateLimitExceeded?.(info);
      throw new Error(`Daily rate limit exceeded. Retry after ${retryAfter}ms`);
    }

    // Check quota
    if (this.quotaUsed >= this.quotaConfig.maxRequestsPerHour) {
      const resetTime = this.quotaLastReset + 3600000;
      const retryAfter = resetTime - now;
      
      const info: QuotaInfo = {
        remaining: 0,
        limit: this.quotaConfig.maxRequestsPerHour,
        reset: resetTime,
        used: this.quotaUsed,
      };

      this.onQuotaExceeded?.(info);
      throw new Error(`Quota exceeded. Retry after ${retryAfter}ms`);
    }

    // Check concurrent requests
    if (this.activeRequests >= this.quotaConfig.maxConcurrentRequests) {
      throw new Error('Maximum concurrent requests reached');
    }

    return {
      remaining: this.rateConfig.requestsPerMinute - minuteRequests,
      reset: (currentMinute + 1) * 60000,
      limit: this.rateConfig.requestsPerMinute,
    };
  }

  // Record a request
  async recordRequest(): Promise<void> {
    const now = Date.now();
    this.requestTimestamps.push(now);
    this.hourlyRequests++;
    this.dailyRequests++;
    this.quotaUsed++;
    this.activeRequests++;

    // Clean up old timestamps (older than 1 hour)
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => now - timestamp < 3600000
    );
  }

  // Complete a request
  async completeRequest(): Promise<void> {
    this.activeRequests--;
    this.processQueue();
  }

  // Execute operation with rate limiting
  async executeWithRateLimit<T>(
    operation: () => Promise<T>,
    priority: number = 0
  ): Promise<T> {
    return new Promise(async (resolve, reject) => {
      try {
        // Check rate limit
        await this.checkRateLimit();
        
        // Record request
        await this.recordRequest();

        try {
          // Execute operation
          const result = await operation();
          
          // Complete request
          await this.completeRequest();
          
          resolve(result);
        } catch (error) {
          await this.completeRequest();
          reject(error);
        }
      } catch (error) {
        // If rate limited, add to queue
        if (error instanceof Error && (
            error.message.includes('Rate limit exceeded') ||
            error.message.includes('Quota exceeded') ||
            error.message.includes('Maximum concurrent requests'))) {
          
          this.addToQueue(operation, priority, resolve, reject);
        } else {
          reject(error);
        }
      }
    });
  }

  // Add operation to queue
  private addToQueue<T>(
    operation: () => Promise<T>,
    priority: number,
    resolve: (value: T) => void,
    reject: (reason?: any) => void
  ): void {
    const queueItem = { operation, priority, resolve, reject };
    
    // Insert based on priority (higher priority first)
    let insertIndex = 0;
    for (let i = 0; i < this.requestQueue.length; i++) {
      if (this.requestQueue[i].priority <= priority) {
        insertIndex = i;
        break;
      }
      insertIndex = i + 1;
    }
    
    this.requestQueue.splice(insertIndex, 0, queueItem as any);
    this.processQueue();
  }

  // Process queued requests
  private async processQueue(): Promise<void> {
    if (this.requestQueue.length === 0 || this.activeRequests >= this.quotaConfig.maxConcurrentRequests) {
      return;
    }

    const nextItem = this.requestQueue.shift();
    if (!nextItem) return;

    try {
      await this.checkRateLimit();
      await this.recordRequest();

      try {
        const result = await nextItem.operation();
        await this.completeRequest();
        nextItem.resolve(result);
      } catch (error) {
        await this.completeRequest();
        nextItem.reject(error);
      }
    } catch (error) {
      // If still rate limited, put back in queue
      if (error instanceof Error && (
          error.message.includes('Rate limit exceeded') ||
          error.message.includes('Quota exceeded') ||
          error.message.includes('Maximum concurrent requests'))) {
        this.requestQueue.unshift(nextItem);
      } else {
        nextItem.reject(error);
      }
    }

    // Process next item
    setImmediate(() => this.processQueue());
  }

  // Get current rate limit info
  getRateLimitInfo(): RateLimitInfo {
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000);
    
    const minuteRequests = this.requestTimestamps.filter(
      timestamp => Math.floor(timestamp / 60000) === currentMinute
    ).length;

    return {
      remaining: Math.max(0, this.rateConfig.requestsPerMinute - minuteRequests),
      reset: (currentMinute + 1) * 60000,
      limit: this.rateConfig.requestsPerMinute,
    };
  }

  // Get current quota info
  getQuotaInfo(): QuotaInfo {
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

  // Get stats
  getStats(): {
    activeRequests: number;
    queuedRequests: number;
    minuteRequests: number;
    hourlyRequests: number;
    dailyRequests: number;
    quotaUsed: number;
  } {
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000);
    
    const minuteRequests = this.requestTimestamps.filter(
      timestamp => Math.floor(timestamp / 60000) === currentMinute
    ).length;

    return {
      activeRequests: this.activeRequests,
      queuedRequests: this.requestQueue.length,
      minuteRequests,
      hourlyRequests: this.hourlyRequests,
      dailyRequests: this.dailyRequests,
      quotaUsed: this.quotaUsed,
    };
  }

  // Reset counters (for testing or manual reset)
  reset(): void {
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

  // Clean up old timestamps
  private cleanupOldRequests(): void {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => timestamp > oneHourAgo
    );
  }

  // Check if quota needs reset
  private checkQuotaReset(): void {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    
    if (this.quotaLastReset < oneHourAgo) {
      this.quotaUsed = 0;
      this.quotaLastReset = now;
    }
  }

  // Start cleanup interval
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupOldRequests();
      this.checkQuotaReset();
    }, 60000); // Clean up every minute
  }
}

// Global rate limiter instance
export const rateLimiter = RateLimiter.getInstance();

// Decorator for rate limiting
export function withRateLimit(priority: number = 0) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return rateLimiter.executeWithRateLimit(
        () => method.apply(this, args),
        priority
      );
    };

    return descriptor;
  };
}

// Utility function to wrap async operations with rate limiting
export async function withRateLimiting<T>(
  operation: () => Promise<T>,
  priority: number = 0
): Promise<T> {
  return rateLimiter.executeWithRateLimit(operation, priority);
}