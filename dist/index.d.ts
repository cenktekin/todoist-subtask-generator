export declare class TodoistSubtaskApp {
    private todoistClient;
    private aiService;
    private taskService;
    private subtaskService;
    private dateService;
    constructor();
    initialize(): Promise<void>;
    testTodoistConnection(): Promise<boolean>;
    testAIConnection(): Promise<boolean>;
    getTasks(filters?: any): Promise<any[]>;
    getProjects(): Promise<any[]>;
    getLabels(): Promise<any[]>;
    getTaskStatistics(): Promise<any>;
    generateSubtaskPreview(taskId: string, options?: any): Promise<any>;
    createSubtasksFromTask(taskId: string, options?: any): Promise<any>;
    createSubtasksForMultipleTasks(taskIds: string[], options?: any): Promise<any[]>;
    calculateTaskSchedule(taskId: string, options?: any): Promise<any>;
    private estimateTaskDuration;
    private calculateTaskPriority;
    getSubtaskCandidates(): Promise<any[]>;
    estimateSubtaskCount(taskId: string): Promise<number>;
    healthCheck(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        services: {
            todoist: 'up' | 'down' | 'degraded';
            ai: 'up' | 'down' | 'degraded';
            rateLimiter: 'up' | 'down';
        };
        timestamp: Date;
    }>;
    getInfo(): {
        name: string;
        version: string;
        environment: string;
        config: {
            todoist: {
                rateLimit: any;
            };
            openrouter: {
                defaultModel: string;
                fallbackModel: string;
            };
            app: {
                port: number;
                logLevel: string;
            };
        };
    };
}
export declare const app: TodoistSubtaskApp;
//# sourceMappingURL=index.d.ts.map