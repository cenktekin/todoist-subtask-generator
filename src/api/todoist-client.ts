import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { config } from '../config/config';
import {
  TodoistTask,
  TodoistProject,
  TodoistLabel,
  TodoistUser,
  CreateTaskRequest,
  UpdateTaskRequest,
  TaskFilterOptions,
  TasksResponse,
  APIError,
  TodoistError,
} from './types';

export class TodoistClient {
  private client: AxiosInstance;
  private rateLimitRemaining: number = 60;
  private rateLimitReset: number = Date.now();

  constructor(apiToken?: string) {
    const token = apiToken || config.todoist.apiToken;
    
    if (!token) {
      throw new Error('Todoist API token is required');
    }

    this.client = axios.create({
      baseURL: 'https://api.todoist.com/rest/v2',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Response interceptor for rate limiting and error handling
    this.client.interceptors.response.use(
      (response) => {
        // Update rate limit info from headers
        const remaining = response.headers['x-ratelimit-remaining'];
        const reset = response.headers['x-ratelimit-reset'];
        
        if (remaining) {
          this.rateLimitRemaining = parseInt(remaining);
        }
        
        if (reset) {
          this.rateLimitReset = parseInt(reset) * 1000;
        }

        return response;
      },
      (error) => {
        if (error.response) {
          // Handle rate limiting
          if (error.response.status === 429) {
            const retryAfter = error.response.headers['retry-after'];
            const resetTime = error.response.headers['x-ratelimit-reset'];
            
            if (retryAfter) {
              const delay = parseInt(retryAfter) * 1000;
              return this.delayRetry(error.config, delay);
            } else if (resetTime) {
              const delay = parseInt(resetTime) * 1000 - Date.now();
              return this.delayRetry(error.config, Math.max(delay, 1000));
            }
          }

          // Transform API errors
          const apiError: APIError = {
            message: error.response.data?.error || error.message,
            status: error.response.status,
            code: error.response.data?.error_code,
            details: error.response.data?.error_extra,
          };
          
          error.apiError = apiError;
        }
        
        return Promise.reject(error);
      }
    );
  }

  private async delayRetry(config: any, delay: number): Promise<AxiosResponse> {
    await new Promise(resolve => setTimeout(resolve, delay));
    return this.client.request(config);
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    if (this.rateLimitRemaining <= 0 && now < this.rateLimitReset) {
      const waitTime = this.rateLimitReset - now;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  // Task Operations
  async getTasks(filterOptions: TaskFilterOptions = {}): Promise<TodoistTask[]> {
    await this.checkRateLimit();
    
    const params: Record<string, string> = {
      lang: 'tr',
    };

    if (filterOptions.project_id) {
      params.project_id = filterOptions.project_id;
    }
    
    if (filterOptions.label) {
      params.label = filterOptions.label;
    }
    
    if (filterOptions.filter) {
      params.filter = filterOptions.filter;
    }

    const response = await this.client.get<TodoistTask[]>('/tasks', { params });
    return response.data;
  }

  async getTask(taskId: string): Promise<TodoistTask> {
    await this.checkRateLimit();
    
    const response = await this.client.get<TodoistTask>(`/tasks/${taskId}`);
    return response.data;
  }

  async createTask(taskData: CreateTaskRequest): Promise<TodoistTask> {
    await this.checkRateLimit();
    
    const response = await this.client.post<TodoistTask>('/tasks', taskData);
    return response.data;
  }

  async updateTask(taskId: string, updateData: UpdateTaskRequest): Promise<TodoistTask> {
    await this.checkRateLimit();
    
    const response = await this.client.post<TodoistTask>(`/tasks/${taskId}`, updateData);
    return response.data;
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.checkRateLimit();
    
    await this.client.delete(`/tasks/${taskId}`);
  }

  async closeTask(taskId: string): Promise<TodoistTask> {
    await this.checkRateLimit();
    
    const response = await this.client.post<TodoistTask>(`/tasks/${taskId}/close`);
    return response.data;
  }

  async reopenTask(taskId: string): Promise<TodoistTask> {
    await this.checkRateLimit();
    
    const response = await this.client.post<TodoistTask>(`/tasks/${taskId}/reopen`);
    return response.data;
  }

  // Project Operations
  async getProjects(): Promise<TodoistProject[]> {
    await this.checkRateLimit();
    
    const response = await this.client.get<TodoistProject[]>('/projects');
    return response.data;
  }

  async getProject(projectId: string): Promise<TodoistProject> {
    await this.checkRateLimit();
    
    const response = await this.client.get<TodoistProject>(`/projects/${projectId}`);
    return response.data;
  }

  // Label Operations
  async getLabels(): Promise<TodoistLabel[]> {
    await this.checkRateLimit();
    
    const response = await this.client.get<TodoistLabel[]>('/labels');
    return response.data;
  }

  // User Operations
  async getUser(): Promise<TodoistUser> {
    await this.checkRateLimit();
    
    const response = await this.client.get<TodoistUser>('/user');
    return response.data;
  }

  // Batch Operations
  async createTasksBatch(tasks: CreateTaskRequest[]): Promise<TodoistTask[]> {
    await this.checkRateLimit();
    
    const batchSize = config.taskProcessing.batchSize;
    const results: TodoistTask[] = [];
    
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      const batchPromises = batch.map(task => this.createTask(task));
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error('Failed to create task:', result.reason);
        }
      });
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < tasks.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  // Utility Methods
  async getTasksWithProjectsAndLabels(): Promise<TasksResponse> {
    await this.checkRateLimit();
    
    const [tasks, projects, labels] = await Promise.all([
      this.getTasks(),
      this.getProjects(),
      this.getLabels(),
    ]);

    return {
      tasks,
      projects,
      labels,
    };
  }

  async getTasksByProject(projectId: string): Promise<TodoistTask[]> {
    return this.getTasks({ project_id: projectId });
  }

  async getTasksByLabel(label: string): Promise<TodoistTask[]> {
    return this.getTasks({ label });
  }

  async getTasksByPriority(priority: number): Promise<TodoistTask[]> {
    const tasks = await this.getTasks();
    return tasks.filter(task => task.priority === priority);
  }

  async getOverdueTasks(): Promise<TodoistTask[]> {
    const tasks = await this.getTasks();
    const now = new Date().toISOString().split('T')[0];
    
    return tasks.filter(task => 
      task.due?.date && task.due.date < now && !task.checked
    );
  }

  async getTasksForToday(): Promise<TodoistTask[]> {
    const today = new Date().toISOString().split('T')[0];
    const tasks = await this.getTasks();
    
    return tasks.filter(task => 
      task.due?.date === today && !task.checked
    );
  }

  // Rate Limit Info
  getRateLimitInfo(): { remaining: number; reset: number } {
    return {
      remaining: this.rateLimitRemaining,
      reset: this.rateLimitReset,
    };
  }
}