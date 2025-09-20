export declare enum ErrorType {
    NETWORK_ERROR = "NETWORK_ERROR",
    API_ERROR = "API_ERROR",
    RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",
    AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
    VALIDATION_ERROR = "VALIDATION_ERROR",
    TIMEOUT_ERROR = "TIMEOUT_ERROR",
    UNKNOWN_ERROR = "UNKNOWN_ERROR"
}
export interface AppError {
    type: ErrorType;
    message: string;
    code?: string;
    details?: Record<string, unknown>;
    originalError?: Error;
    timestamp: Date;
    retryable: boolean;
}
export declare class ErrorHandler {
    private static instance;
    private errorCallbacks;
    private constructor();
    static getInstance(): ErrorHandler;
    private initializeErrorTypes;
    onError(errorType: ErrorType, callback: (error: AppError) => void): void;
    offError(errorType: ErrorType, callback: (error: AppError) => void): void;
    createError(error: unknown, context?: Record<string, unknown>): AppError;
    private handleAxiosError;
    handleErrorWithRetry<T>(operation: () => Promise<T>, maxRetries?: number, retryDelayMs?: number, context?: Record<string, unknown>): Promise<T>;
    emitError(error: AppError): void;
    isRetryable(error: unknown): boolean;
    getUserFriendlyMessage(error: unknown): string;
    logError(error: unknown, context?: Record<string, unknown>): void;
    createCustomError(type: ErrorType, message: string, code?: string, details?: Record<string, unknown>, retryable?: boolean): AppError;
}
export declare const errorHandler: ErrorHandler;
export declare function withRetry(maxRetries?: number, retryDelayMs?: number): (target: any, propertyName: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
export declare class ApplicationError extends Error {
    readonly type: ErrorType;
    readonly code?: string | undefined;
    readonly retryable: boolean;
    readonly details?: Record<string, unknown> | undefined;
    constructor(message: string, type: ErrorType, code?: string | undefined, retryable?: boolean, details?: Record<string, unknown> | undefined);
}
export declare function withErrorHandling<T>(operation: () => Promise<T>, context?: Record<string, unknown>): Promise<T>;
//# sourceMappingURL=error-handler.d.ts.map