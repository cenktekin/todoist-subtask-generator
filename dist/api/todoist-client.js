"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TodoistClient = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../config/config");
class TodoistClient {
    constructor(apiToken) {
        this.rateLimitRemaining = 60;
        this.rateLimitReset = Date.now();
        this.isUnifiedApi = false;
        this.tokenPlaceholder = false;
        const token = apiToken || config_1.config.todoist.apiToken;
        if (!token) {
            throw new Error('Todoist API token is required');
        }
        this.client = axios_1.default.create({
            baseURL: config_1.config.todoist.baseUrl || 'https://api.todoist.com/rest/v2',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            timeout: 30000,
        });
        if ((config_1.config.todoist.baseUrl || '').includes('/api/v1')) {
            this.isUnifiedApi = true;
        }
        if (/your_todoist_api_token_here/i.test(token)) {
            this.tokenPlaceholder = true;
            console.warn('[TodoistClient] Placeholder TODOIST_API_TOKEN kullanılıyor. Gerçek token ile değiştirin. (401 Unauthorized alırsınız)');
        }
        this.client.interceptors.response.use((response) => {
            const remaining = response.headers['x-ratelimit-remaining'];
            const reset = response.headers['x-ratelimit-reset'];
            if (remaining) {
                this.rateLimitRemaining = parseInt(remaining);
            }
            if (reset) {
                this.rateLimitReset = parseInt(reset) * 1000;
            }
            return response;
        }, (error) => {
            if (error.response) {
                if (error.response.status === 429) {
                    const retryAfter = error.response.headers['retry-after'];
                    const resetTime = error.response.headers['x-ratelimit-reset'];
                    if (retryAfter) {
                        const delay = parseInt(retryAfter) * 1000;
                        return this.delayRetry(error.config, delay);
                    }
                    else if (resetTime) {
                        const delay = parseInt(resetTime) * 1000 - Date.now();
                        return this.delayRetry(error.config, Math.max(delay, 1000));
                    }
                }
                const apiError = {
                    message: error.response.data?.error || error.message,
                    status: error.response.status,
                    code: error.response.data?.error_code,
                    details: error.response.data?.error_extra,
                };
                error.apiError = apiError;
            }
            return Promise.reject(error);
        });
    }
    async delayRetry(config, delay) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.client.request(config);
    }
    async checkRateLimit() {
        const now = Date.now();
        if (this.rateLimitRemaining <= 0 && now < this.rateLimitReset) {
            const waitTime = this.rateLimitReset - now;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
    async getTasks(filterOptions = {}) {
        await this.checkRateLimit();
        const params = {};
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
        const response = await this.client.get('/tasks', { params });
        return this.normalizeListResponse(response.data);
    }
    async getTask(taskId) {
        await this.checkRateLimit();
        const response = await this.client.get(`/tasks/${taskId}`);
        return response.data;
    }
    async createTask(taskData) {
        await this.checkRateLimit();
        const response = await this.client.post('/tasks', taskData);
        return response.data;
    }
    async updateTask(taskId, updateData) {
        await this.checkRateLimit();
        const response = await this.client.post(`/tasks/${taskId}`, updateData);
        return response.data;
    }
    async deleteTask(taskId) {
        await this.checkRateLimit();
        await this.client.delete(`/tasks/${taskId}`);
    }
    async closeTask(taskId) {
        await this.checkRateLimit();
        const response = await this.client.post(`/tasks/${taskId}/close`);
        return response.data;
    }
    async reopenTask(taskId) {
        await this.checkRateLimit();
        const response = await this.client.post(`/tasks/${taskId}/reopen`);
        return response.data;
    }
    async getProjects() {
        await this.checkRateLimit();
        const response = await this.client.get('/projects');
        return this.normalizeListResponse(response.data);
    }
    async getProject(projectId) {
        await this.checkRateLimit();
        const response = await this.client.get(`/projects/${projectId}`);
        return response.data;
    }
    async getLabels() {
        await this.checkRateLimit();
        const response = await this.client.get('/labels');
        return this.normalizeListResponse(response.data);
    }
    async testConnection() {
        try {
            await this.checkRateLimit();
            const res = await this.client.get('/projects', { params: this.isUnifiedApi ? { limit: 1 } : undefined });
            if (res.status === 200) {
                return true;
            }
            return false;
        }
        catch (e) {
            if (e?.response?.status === 401 && this.tokenPlaceholder) {
                console.error('[TodoistClient] 401 Unauthorized: Placeholder token tespit edildi. Geçerli TODOIST_API_TOKEN .env dosyasına ekleyin.');
            }
            return false;
        }
    }
    async createTasksBatch(tasks) {
        await this.checkRateLimit();
        const batchSize = config_1.config.taskProcessing.batchSize;
        const results = [];
        for (let i = 0; i < tasks.length; i += batchSize) {
            const batch = tasks.slice(i, i + batchSize);
            const batchPromises = batch.map(task => this.createTask(task));
            const batchResults = await Promise.allSettled(batchPromises);
            batchResults.forEach(result => {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                }
                else {
                    console.error('Failed to create task:', result.reason);
                }
            });
            if (i + batchSize < tasks.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        return results;
    }
    async getTasksWithProjectsAndLabels() {
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
    async getTasksByProject(projectId) {
        return this.getTasks({ project_id: projectId });
    }
    async getTasksByLabel(label) {
        return this.getTasks({ label });
    }
    async getTasksByPriority(priority) {
        const tasks = await this.getTasks();
        return tasks.filter(task => task.priority === priority);
    }
    async getOverdueTasks() {
        const tasks = await this.getTasks();
        const now = new Date().toISOString().split('T')[0];
        return tasks.filter(task => task.due?.date && task.due.date < now && !task.checked);
    }
    async getTasksForToday() {
        const today = new Date().toISOString().split('T')[0];
        const tasks = await this.getTasks();
        return tasks.filter(task => task.due?.date === today && !task.checked);
    }
    getRateLimitInfo() {
        return {
            remaining: this.rateLimitRemaining,
            reset: this.rateLimitReset,
        };
    }
    normalizeListResponse(data) {
        if (Array.isArray(data))
            return data;
        if (data && Array.isArray(data.results))
            return data.results;
        return [];
    }
    async fetchAllPages(path, params = {}) {
        if (!this.isUnifiedApi) {
            const res = await this.client.get(path, { params });
            return this.normalizeListResponse(res.data);
        }
        const all = [];
        let cursor = undefined;
        let safety = 0;
        do {
            const pageParams = { ...params };
            if (cursor)
                pageParams.cursor = cursor;
            if (!pageParams.limit)
                pageParams.limit = 200;
            const res = await this.client.get(path, { params: pageParams });
            const items = this.normalizeListResponse(res.data);
            all.push(...items);
            cursor = res.data?.next_cursor;
            safety++;
        } while (cursor && safety < 20);
        return all;
    }
}
exports.TodoistClient = TodoistClient;
//# sourceMappingURL=todoist-client.js.map