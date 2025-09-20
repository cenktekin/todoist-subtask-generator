export declare const config: {
    todoist: {
        apiToken: string;
        baseUrl: string;
        rateLimit: {
            requestsPerMinute: number;
            requestsPerHour: number;
            requestsPerDay: number;
        };
    };
    openrouter: {
        apiKey: string;
        defaultModel: string;
        fallbackModel: string;
        maxTokens: number;
        temperature: number;
        baseUrl: string;
    };
    app: {
        port: number;
        environment: string;
        logLevel: string;
    };
    database: {
        path: string;
    };
    taskProcessing: {
        maxRetries: number;
        retryDelayMs: number;
        batchSize: number;
    };
    subtaskGeneration: {
        maxSubtasks: number;
        minSubtaskLength: number;
        maxSubtaskLength: number;
    };
    date: {
        timezone: string;
        dateFormat: string;
        timeFormat: string;
    };
};
export declare function validateConfig(): void;
//# sourceMappingURL=config.d.ts.map