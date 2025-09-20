import { SubtaskGenerationRequest, SubtaskGenerationResponse } from '../api/types';
export declare class AIService {
    private client;
    private availableModels;
    constructor();
    private initializeClient;
    getAvailableModels(): Promise<string[]>;
    generateSubtasks(request: SubtaskGenerationRequest): Promise<SubtaskGenerationResponse>;
    private callOpenAI;
    private parseAIResponse;
    estimateTaskDuration(taskContent: string, taskDescription?: string): Promise<string>;
    categorizeTask(taskContent: string, taskDescription?: string): Promise<string[]>;
    testConnection(): Promise<boolean>;
}
//# sourceMappingURL=ai-service.d.ts.map