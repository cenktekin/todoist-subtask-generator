import { AxiosError } from 'axios';
import { config } from '../config/config';

export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
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

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorCallbacks: Map<ErrorType, ((error: AppError) => void)[]> = new Map();

  private constructor() {
    this.initializeErrorTypes();
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  private initializeErrorTypes(): void {
    Object.values(ErrorType).forEach(type => {
      this.errorCallbacks.set(type, []);
    });
  }

  // Register error callback
  onError(errorType: ErrorType, callback: (error: AppError) => void): void {
    const callbacks = this.errorCallbacks.get(errorType) || [];
    callbacks.push(callback);
    this.errorCallbacks.set(errorType, callbacks);
  }

  // Remove error callback
  offError(errorType: ErrorType, callback: (error: AppError) => void): void {
    const callbacks = this.errorCallbacks.get(errorType) || [];
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
      this.errorCallbacks.set(errorType, callbacks);
    }
  }

  // Create app error from various error sources
  createError(error: unknown, context?: Record<string, unknown>): AppError {
    const appError: AppError = {
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

    // Handle Axios errors
    if (error instanceof AxiosError) {
      this.handleAxiosError(appError, error);
    }

    // Add context if provided
    if (context) {
      appError.details = { ...appError.details, ...context };
    }

    return appError;
  }

  private handleAxiosError(appError: AppError, axiosError: AxiosError): void {
    const status = axiosError.response?.status;
    const data = axiosError.response?.data as any;

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

      case -1: // Network error
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

  // Handle error with retry logic
  async handleErrorWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = config.taskProcessing.maxRetries,
    retryDelayMs: number = config.taskProcessing.retryDelayMs,
    context?: Record<string, unknown>
  ): Promise<T> {
    let lastError: AppError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const appError = this.createError(error, context);
        lastError = appError;

        // Don't retry non-retryable errors
        if (!appError.retryable) {
          this.emitError(appError);
          throw appError;
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          this.emitError(appError);
          throw appError;
        }

        // Calculate delay with exponential backoff
        const delay = retryDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
        
        console.warn(`Attempt ${attempt + 1} failed. Retrying in ${delay}ms...`, appError.message);

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  // Emit error to registered callbacks
  public emitError(error: AppError): void {
    const callbacks = this.errorCallbacks.get(error.type) || [];
    callbacks.forEach(callback => {
      try {
        callback(error);
      } catch (callbackError) {
        console.error('Error in error callback:', callbackError);
      }
    });

    // Also emit to unknown error callbacks
    if (error.type !== ErrorType.UNKNOWN_ERROR) {
      const unknownCallbacks = this.errorCallbacks.get(ErrorType.UNKNOWN_ERROR) || [];
      unknownCallbacks.forEach(callback => {
        try {
          callback(error);
        } catch (callbackError) {
          console.error('Error in unknown error callback:', callbackError);
        }
      });
    }
  }

  // Check if error is retryable
  isRetryable(error: unknown): boolean {
    const appError = this.createError(error);
    return appError.retryable;
  }

  // Get user-friendly error message
  getUserFriendlyMessage(error: unknown): string {
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

  // Log error with details
  logError(error: unknown, context?: Record<string, unknown>): void {
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

  // Create custom error
  createCustomError(
    type: ErrorType,
    message: string,
    code?: string,
    details?: Record<string, unknown>,
    retryable: boolean = false
  ): AppError {
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

// Global error handler instance
export const errorHandler = ErrorHandler.getInstance();

// Decorator for automatic error handling and retry
export function withRetry(maxRetries?: number, retryDelayMs?: number) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const maxRetriesValue = maxRetries ?? config.taskProcessing.maxRetries;
      const retryDelayMsValue = retryDelayMs ?? config.taskProcessing.retryDelayMs;

      return errorHandler.handleErrorWithRetry(
        () => method.apply(this, args),
        maxRetriesValue,
        retryDelayMsValue,
        { method: propertyName, class: target.constructor.name }
      );
    };

    return descriptor;
  };
}

// Error class for specific application errors
export class ApplicationError extends Error {
  constructor(
    message: string,
    public readonly type: ErrorType,
    public readonly code?: string,
    public readonly retryable: boolean = false,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}

// Utility function to wrap async operations with error handling
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const appError = errorHandler.createError(error, context);
    errorHandler.emitError(appError);
    throw appError;
  }
}