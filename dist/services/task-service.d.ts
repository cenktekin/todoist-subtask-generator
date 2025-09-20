import { TodoistClient } from '../api/todoist-client';
import { TodoistTask, TodoistProject, TodoistLabel } from '../api/types';
export interface TaskSummary {
    id: string;
    content: string;
    description?: string;
    priority: number;
    due?: string;
    project?: string;
    labels: string[];
    hasSubtasks: boolean;
    isCompleted: boolean;
    isOverdue: boolean;
}
export interface TaskFilter {
    projectId?: string;
    label?: string;
    priority?: number;
    dueDate?: {
        from?: string;
        to?: string;
    };
    status?: 'active' | 'completed' | 'all';
    searchQuery?: string;
}
export declare class TaskService {
    private todoistClient;
    constructor(todoistClient: TodoistClient);
    getTasksWithFilters(filters?: TaskFilter): Promise<TaskSummary[]>;
    getTasksForSubtaskGeneration(): Promise<TaskSummary[]>;
    getTaskDetails(taskId: string): Promise<{
        task: TodoistTask;
        project?: TodoistProject;
        labels: TodoistLabel[];
        subtasks?: TodoistTask[];
    }>;
    getTasksByProject(): Promise<{
        project: TodoistProject;
        tasks: TaskSummary[];
        completedCount: number;
        overdueCount: number;
    }[]>;
    getTaskStatistics(): Promise<{
        totalTasks: number;
        completedTasks: number;
        overdueTasks: number;
        todayTasks: number;
        highPriorityTasks: number;
        tasksByPriority: Record<number, number>;
        tasksByProject: Record<string, number>;
    }>;
    private convertToTaskSummaries;
    private isTaskOverdue;
    private sortTasks;
    getOverdueTasks(): Promise<TaskSummary[]>;
    getTodayTasks(): Promise<TaskSummary[]>;
    getHighPriorityTasks(): Promise<TaskSummary[]>;
    getTasksWithoutDueDate(): Promise<TaskSummary[]>;
}
//# sourceMappingURL=task-service.d.ts.map