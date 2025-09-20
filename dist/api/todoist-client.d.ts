import { TodoistTask, TodoistProject, TodoistLabel, TodoistUser, CreateTaskRequest, UpdateTaskRequest, TaskFilterOptions, TasksResponse } from './types';
export declare class TodoistClient {
    private client;
    private rateLimitRemaining;
    private rateLimitReset;
    constructor(apiToken?: string);
    private delayRetry;
    private checkRateLimit;
    getTasks(filterOptions?: TaskFilterOptions): Promise<TodoistTask[]>;
    getTask(taskId: string): Promise<TodoistTask>;
    createTask(taskData: CreateTaskRequest): Promise<TodoistTask>;
    updateTask(taskId: string, updateData: UpdateTaskRequest): Promise<TodoistTask>;
    deleteTask(taskId: string): Promise<void>;
    closeTask(taskId: string): Promise<TodoistTask>;
    reopenTask(taskId: string): Promise<TodoistTask>;
    getProjects(): Promise<TodoistProject[]>;
    getProject(projectId: string): Promise<TodoistProject>;
    getLabels(): Promise<TodoistLabel[]>;
    getUser(): Promise<TodoistUser>;
    createTasksBatch(tasks: CreateTaskRequest[]): Promise<TodoistTask[]>;
    getTasksWithProjectsAndLabels(): Promise<TasksResponse>;
    getTasksByProject(projectId: string): Promise<TodoistTask[]>;
    getTasksByLabel(label: string): Promise<TodoistTask[]>;
    getTasksByPriority(priority: number): Promise<TodoistTask[]>;
    getOverdueTasks(): Promise<TodoistTask[]>;
    getTasksForToday(): Promise<TodoistTask[]>;
    getRateLimitInfo(): {
        remaining: number;
        reset: number;
    };
}
//# sourceMappingURL=todoist-client.d.ts.map