import { TodoistClient } from '../api/todoist-client';
import { AIService } from './ai-service';
import { TaskService, TaskSummary } from './task-service';
export interface SubtaskCreationResult {
    taskId: string;
    subtasksCreated: number;
    subtasks: Array<{
        content: string;
        due?: string;
        priority?: number;
        todoistId?: string;
    }>;
    errors: string[];
    estimatedDuration: string;
}
export interface SubtaskCreationOptions {
    distributeByTime?: boolean;
    timeDistribution?: 'equal' | 'weighted' | 'sequential';
    maxSubtasksPerDay?: number;
    includeWeekends?: boolean;
    priorityStrategy?: 'inherit' | 'distribute' | 'constant';
    constantPriority?: number;
    additionalContext?: string;
}
export declare class SubtaskService {
    private todoistClient;
    private aiService;
    private taskService;
    constructor(todoistClient: TodoistClient, aiService: AIService, taskService: TaskService);
    createSubtasksFromTask(taskId: string, options?: SubtaskCreationOptions): Promise<SubtaskCreationResult>;
    generateSubtaskPreview(taskId: string, options?: SubtaskCreationOptions): Promise<{
        subtasks: Array<{
            content: string;
            due?: string;
            priority?: number;
        }>;
        estimatedDuration: string;
    }>;
    createSubtasksForMultipleTasks(taskIds: string[], options?: SubtaskCreationOptions): Promise<SubtaskCreationResult[]>;
    private distributeSubtasksByDate;
    private applyPriorityStrategy;
    private createSubtasksInTodoist;
    private calculateDaysBetween;
    private addDaysToDate;
    private formatDate;
    getSubtaskCandidates(): Promise<TaskSummary[]>;
    private estimateOptimalSubtaskCount;
    estimateSubtaskCount(taskId: string): Promise<number>;
}
//# sourceMappingURL=subtask-service.d.ts.map