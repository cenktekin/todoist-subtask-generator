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
  private isUnifiedApi: boolean = false; // Heuristik: /api/v1 tabanlı endpoint kullanımı
  private tokenPlaceholder: boolean = false;

  constructor(apiToken?: string) {
    const token = apiToken || config.todoist.apiToken;
    
    if (!token) {
      throw new Error('Todoist API token is required');
    }

    // Use configured base URL (defaults to REST v2). Centralize in config to allow future migration.
    this.client = axios.create({
      baseURL: config.todoist.baseUrl || 'https://api.todoist.com/rest/v2',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // API sürümü belirleme (basit heuristic)
    // Yeni birleşik API: https://api.todoist.com/api/v1/... (pagination ve {results: []} yapısı)
    // Eski REST v2: https://api.todoist.com/rest/v2/... (düz array)
    if ((config.todoist.baseUrl || '').includes('/api/v1')) {
      this.isUnifiedApi = true;
    }

    // Placeholder token kontrolü (geliştirici deneyimi için erken uyarı)
    if (/your_todoist_api_token_here/i.test(token)) {
      this.tokenPlaceholder = true;
      // eslint-disable-next-line no-console
      console.warn('[TodoistClient] Placeholder TODOIST_API_TOKEN kullanılıyor. Gerçek token ile değiştirin. (401 Unauthorized alırsınız)');
    }

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
    
    const params: Record<string, string> = {};

    // Birleşik API v1 dokümantasyonuna göre /tasks endpoint'inde lang parametresi kaldırıldı.
    // Eski REST v2 için lang parametresi sorun çıkarmazsa ekleyebiliriz; yalnızca REST v2 ise ekleyelim.
    if (!this.isUnifiedApi) {
      params.lang = 'tr';
    }

    if (filterOptions.project_id) {
      params.project_id = filterOptions.project_id;
    }
    
    if (filterOptions.label) {
      params.label = filterOptions.label;
    }
    
    if (filterOptions.filter) {
      params.filter = filterOptions.filter;
    }

    const response = await this.client.get<any>('/tasks', { params });
    return this.normalizeListResponse<TodoistTask>(response.data);
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
    
    const response = await this.client.get<any>('/projects');
    return this.normalizeListResponse<TodoistProject>(response.data);
  }

  async getProject(projectId: string): Promise<TodoistProject> {
    await this.checkRateLimit();
    
    const response = await this.client.get<TodoistProject>(`/projects/${projectId}`);
    return response.data;
  }

  // Label Operations
  async getLabels(): Promise<TodoistLabel[]> {
    await this.checkRateLimit();
    
    const response = await this.client.get<any>('/labels');
    return this.normalizeListResponse<TodoistLabel>(response.data);
  }

  // There is no /user endpoint in REST v2; a connectivity check can instead fetch projects (lightweight)
  async testConnection(): Promise<boolean> {
    try {
      await this.checkRateLimit();
      // Küçük bir istek: projeleri bir sayfa çek (pagination varsa ilk sayfa yeterli)
      const res = await this.client.get('/projects', { params: this.isUnifiedApi ? { limit: 1 } : undefined });
      // 401 özel bilgilendirme
      if (res.status === 200) {
        return true;
      }
      return false;
    } catch (e: any) {
      if (e?.response?.status === 401 && this.tokenPlaceholder) {
        // eslint-disable-next-line no-console
        console.error('[TodoistClient] 401 Unauthorized: Placeholder token tespit edildi. Geçerli TODOIST_API_TOKEN .env dosyasına ekleyin.');
      }
      return false;
    }
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

  // ---- İç Yardımcılar ----
  private normalizeListResponse<T>(data: any): T[] {
    // REST v2: doğrudan array
    if (Array.isArray(data)) return data as T[];
    // Unified API v1: { results: [...], next_cursor?: string }
    if (data && Array.isArray(data.results)) return data.results as T[];
    // Bilinmeyen şekil -> boş liste
    return [];
  }

  // (Gerektiğinde genişletmek için) Unified API pagination tam almak istenirse kullanılabilir
  private async fetchAllPages<T>(path: string, params: Record<string, any> = {}): Promise<T[]> {
    if (!this.isUnifiedApi) {
      const res = await this.client.get<any>(path, { params });
      return this.normalizeListResponse<T>(res.data);
    }

    const all: T[] = [];
    let cursor: string | undefined = undefined;
    let safety = 0;
    do {
      const pageParams = { ...params } as any;
      if (cursor) pageParams.cursor = cursor;
      if (!pageParams.limit) pageParams.limit = 200; // az sayıda call ile maksimum
      const res = await this.client.get<any>(path, { params: pageParams });
      const items = this.normalizeListResponse<T>(res.data);
      all.push(...items);
      cursor = res.data?.next_cursor;
      safety++;
    } while (cursor && safety < 20); // 20 sayfa güvenlik limiti
    return all;
  }
}