"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = exports.TodoistSubtaskApp = void 0;
const todoist_client_1 = require("./api/todoist-client");
const ai_service_1 = require("./services/ai-service");
const task_service_1 = require("./services/task-service");
const subtask_service_1 = require("./services/subtask-service");
const date_service_1 = require("./services/date-service");
const error_handler_1 = require("./utils/error-handler");
const rate_limiter_1 = require("./utils/rate-limiter");
const config_1 = require("./config/config");
const winston_1 = __importDefault(require("winston"));
const logger = winston_1.default.createLogger({
    level: config_1.config.app.logLevel,
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
    transports: [
        new winston_1.default.transports.Console(),
        new winston_1.default.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston_1.default.transports.File({ filename: 'logs/combined.log' }),
    ],
});
error_handler_1.errorHandler.onError(error_handler_1.ErrorType.UNKNOWN_ERROR, (error) => {
    logger.error('Global error handler:', error);
});
error_handler_1.errorHandler.onError(error_handler_1.ErrorType.API_ERROR, (error) => {
    logger.warn('API error:', error);
});
error_handler_1.errorHandler.onError(error_handler_1.ErrorType.RATE_LIMIT_ERROR, (error) => {
    logger.warn('Rate limit exceeded:', error);
});
rate_limiter_1.rateLimiter.setRateLimitCallback((info) => {
    logger.warn('Rate limit info:', info);
});
rate_limiter_1.rateLimiter.setQuotaCallback((info) => {
    logger.warn('Quota info:', info);
});
class TodoistSubtaskApp {
    constructor() {
        try {
            (0, config_1.validateConfig)();
            this.todoistClient = new todoist_client_1.TodoistClient();
            this.aiService = new ai_service_1.AIService();
            this.taskService = new task_service_1.TaskService(this.todoistClient);
            this.subtaskService = new subtask_service_1.SubtaskService(this.todoistClient, this.aiService, this.taskService);
            this.dateService = new date_service_1.DateService();
            logger.info('Todoist Subtask Generator initialized successfully');
        }
        catch (error) {
            logger.error('Failed to initialize application:', error);
            throw error;
        }
    }
    async initialize() {
        try {
            const [todoistConnected, aiConnected] = await Promise.all([
                this.testTodoistConnection(),
                this.testAIConnection(),
            ]);
            if (!todoistConnected) {
                logger.warn('Todoist API connection failed, but application will continue with AI service only');
            }
            if (!aiConnected) {
                throw new Error('Failed to connect to AI service');
            }
            logger.info('Application initialized successfully');
        }
        catch (error) {
            logger.error('Initialization failed:', error);
            throw error;
        }
    }
    async testTodoistConnection() {
        try {
            const ok = await this.todoistClient.testConnection();
            if (ok) {
                logger.info('Connected to Todoist (projects fetch succeeded)');
                return true;
            }
            logger.warn('Todoist connection test failed');
            return false;
        }
        catch (error) {
            logger.error('Todoist connection failed:', error);
            return false;
        }
    }
    async testAIConnection() {
        try {
            const connected = await this.aiService.testConnection();
            if (connected) {
                logger.info('AI service connection successful');
            }
            else {
                logger.warn('AI service connection failed');
            }
            return connected;
        }
        catch (error) {
            logger.error('AI connection test failed:', error);
            return false;
        }
    }
    async getTasks(filters) {
        try {
            return await rate_limiter_1.rateLimiter.executeWithRateLimit(async () => {
                const tasks = await this.taskService.getTasksWithFilters(filters);
                logger.info(`Retrieved ${tasks.length} tasks`);
                return tasks;
            });
        }
        catch (error) {
            logger.error('Failed to get tasks:', error);
            throw error;
        }
    }
    async getProjects() {
        try {
            return await rate_limiter_1.rateLimiter.executeWithRateLimit(async () => {
                const projects = await this.todoistClient.getProjects();
                logger.info(`Retrieved ${projects.length} projects`);
                return projects;
            });
        }
        catch (error) {
            logger.error('Failed to get projects:', error);
            throw error;
        }
    }
    async getLabels() {
        try {
            return await rate_limiter_1.rateLimiter.executeWithRateLimit(async () => {
                const labels = await this.todoistClient.getLabels();
                logger.info(`Retrieved ${labels.length} labels`);
                return labels;
            });
        }
        catch (error) {
            logger.error('Failed to get labels:', error);
            throw error;
        }
    }
    async getTaskStatistics() {
        try {
            return await rate_limiter_1.rateLimiter.executeWithRateLimit(async () => {
                const stats = await this.taskService.getTaskStatistics();
                logger.info('Retrieved task statistics');
                return stats;
            });
        }
        catch (error) {
            logger.error('Failed to get task statistics:', error);
            throw error;
        }
    }
    async generateSubtaskPreview(taskId, options) {
        try {
            return await rate_limiter_1.rateLimiter.executeWithRateLimit(async () => {
                const preview = await this.subtaskService.generateSubtaskPreview(taskId, options);
                logger.info(`Generated subtask preview for task ${taskId}`);
                return preview;
            });
        }
        catch (error) {
            logger.error('Failed to generate subtask preview:', error);
            throw error;
        }
    }
    async createSubtasksFromTask(taskId, options) {
        try {
            return await rate_limiter_1.rateLimiter.executeWithRateLimit(async () => {
                const result = await this.subtaskService.createSubtasksFromTask(taskId, options);
                logger.info(`Created ${result.subtasksCreated} subtasks for task ${taskId}`);
                return result;
            });
        }
        catch (error) {
            logger.error('Failed to create subtasks:', error);
            throw error;
        }
    }
    async createSubtasksForMultipleTasks(taskIds, options) {
        try {
            return await rate_limiter_1.rateLimiter.executeWithRateLimit(async () => {
                const results = await this.subtaskService.createSubtasksForMultipleTasks(taskIds, options);
                const totalCreated = results.reduce((sum, result) => sum + result.subtasksCreated, 0);
                logger.info(`Created ${totalCreated} subtasks for ${taskIds.length} tasks`);
                return results;
            });
        }
        catch (error) {
            logger.error('Failed to create subtasks for multiple tasks:', error);
            throw error;
        }
    }
    async calculateTaskSchedule(taskId, options) {
        try {
            const taskDetails = await this.taskService.getTaskDetails(taskId);
            const task = taskDetails.task;
            const existingSubtasks = taskDetails.subtasks || [];
            let subtasksWithDuration = [];
            if (existingSubtasks.length > 0) {
                subtasksWithDuration = existingSubtasks.map(st => {
                    const estimatedHours = this.estimateTaskDuration(st.content);
                    return {
                        content: st.content,
                        estimatedHours,
                        due: st.due?.date,
                        priority: st.priority
                    };
                });
            }
            else {
                const aiRequest = {
                    taskContent: task.content,
                    taskDescription: task.description,
                    dueDate: task.due?.date,
                    maxSubtasks: 5,
                };
                const aiResponse = await this.aiService.generateSubtasks(aiRequest);
                subtasksWithDuration = aiResponse.subtasks.map(st => {
                    const estimatedHours = this.estimateTaskDuration(st.content);
                    return {
                        content: st.content,
                        estimatedHours,
                        due: st.due,
                        priority: st.priority
                    };
                });
            }
            const schedule = this.dateService.calculateTaskSchedule(task.content, task.due?.date ? new Date(task.due.date) : new Date(), subtasksWithDuration, {
                workDayStart: '09:00',
                workDayEnd: '17:00',
                includeWeekends: false,
                dailyWorkHours: 8,
                bufferTime: 1,
                timezone: config_1.config.date.timezone,
                ...options
            });
            const formattedSchedule = {
                taskId,
                taskContent: task.content,
                dueDate: task.due?.date,
                startDate: this.dateService.formatDateForTodoist(schedule.startDate),
                endDate: this.dateService.formatDateForTodoist(schedule.endDate),
                totalDuration: `${schedule.totalDuration} saat`,
                totalWorkDays: this.dateService.getWorkDaysBetween(schedule.startDate, schedule.endDate),
                subtasks: schedule.subtasks.map((st, index) => ({
                    id: index + 1,
                    content: st.content,
                    dueDate: this.dateService.formatDateForTodoist(st.dueDate),
                    duration: `${st.duration} saat`,
                    dayNumber: this.dateService.getDaysBetween(schedule.startDate, st.dueDate) + 1,
                    isWeekend: st.dueDate.getDay() === 0 || st.dueDate.getDay() === 6,
                    priority: this.calculateTaskPriority(st.content, index, schedule.subtasks.length)
                })),
                summary: {
                    totalSubtasks: schedule.subtasks.length,
                    totalEstimatedHours: schedule.totalDuration,
                    workDays: this.dateService.getWorkDaysBetween(schedule.startDate, schedule.endDate),
                    startDate: this.dateService.formatDateForTodoist(schedule.startDate),
                    endDate: this.dateService.formatDateForTodoist(schedule.endDate)
                }
            };
            logger.info(`Calculated schedule for task ${taskId}`);
            return formattedSchedule;
        }
        catch (error) {
            logger.error('Failed to calculate task schedule:', error);
            throw error;
        }
    }
    estimateTaskDuration(content) {
        const words = content.split(' ').length;
        if (words <= 5)
            return 0.5;
        if (words <= 10)
            return 1;
        if (words <= 20)
            return 2;
        if (words <= 50)
            return 4;
        return 8;
    }
    calculateTaskPriority(content, index, total) {
        const highPriorityKeywords = ['acil', 'öncelikli', 'kritik', 'hızlı', 'teslim'];
        const mediumPriorityKeywords = ['planla', 'hazırla', 'kontrol', 'gönder', 'araştır'];
        const contentLower = content.toLowerCase();
        if (highPriorityKeywords.some(keyword => contentLower.includes(keyword))) {
            return 1;
        }
        if (mediumPriorityKeywords.some(keyword => contentLower.includes(keyword))) {
            return 2;
        }
        if (index < total * 0.3) {
            return 2;
        }
        else if (index < total * 0.7) {
            return 3;
        }
        else {
            return 4;
        }
    }
    async getSubtaskCandidates() {
        try {
            return await rate_limiter_1.rateLimiter.executeWithRateLimit(async () => {
                const candidates = await this.subtaskService.getSubtaskCandidates();
                logger.info(`Found ${candidates.length} subtask candidates`);
                return candidates;
            });
        }
        catch (error) {
            logger.error('Failed to get subtask candidates:', error);
            throw error;
        }
    }
    async estimateSubtaskCount(taskId) {
        try {
            return await rate_limiter_1.rateLimiter.executeWithRateLimit(async () => {
                const count = await this.subtaskService.estimateSubtaskCount(taskId);
                logger.info(`Estimated ${count} subtasks for task ${taskId}`);
                return count;
            });
        }
        catch (error) {
            logger.error('Failed to estimate subtask count:', error);
            throw error;
        }
    }
    async healthCheck() {
        const healthCheck = {
            status: 'healthy',
            services: {
                todoist: 'up',
                ai: 'up',
                rateLimiter: 'up',
            },
            timestamp: new Date(),
        };
        try {
            try {
                const ok = await this.todoistClient.testConnection();
                healthCheck.services.todoist = ok ? 'up' : 'down';
                if (!ok)
                    healthCheck.status = 'unhealthy';
            }
            catch (error) {
                healthCheck.services.todoist = 'down';
                healthCheck.status = 'unhealthy';
            }
            try {
                const connected = await this.aiService.testConnection();
                healthCheck.services.ai = connected ? 'up' : 'down';
                if (!connected) {
                    healthCheck.status = 'degraded';
                }
            }
            catch (error) {
                healthCheck.services.ai = 'down';
                healthCheck.status = 'unhealthy';
            }
            try {
                const stats = rate_limiter_1.rateLimiter.getStats();
                healthCheck.services.rateLimiter = 'up';
                if (stats.queuedRequests > 10 || stats.activeRequests >= 8) {
                    healthCheck.status = 'degraded';
                }
            }
            catch (error) {
                healthCheck.services.rateLimiter = 'down';
                healthCheck.status = 'unhealthy';
            }
            logger.info('Health check completed:', healthCheck);
            return healthCheck;
        }
        catch (error) {
            logger.error('Health check failed:', error);
            return {
                status: 'unhealthy',
                services: {
                    todoist: 'down',
                    ai: 'down',
                    rateLimiter: 'down',
                },
                timestamp: new Date(),
            };
        }
    }
    getInfo() {
        return {
            name: 'Todoist Subtask Generator',
            version: '1.0.0',
            environment: config_1.config.app.environment,
            config: {
                todoist: {
                    rateLimit: config_1.config.todoist.rateLimit,
                },
                openrouter: {
                    defaultModel: config_1.config.openrouter.defaultModel,
                    fallbackModel: config_1.config.openrouter.fallbackModel,
                },
                app: {
                    port: config_1.config.app.port,
                    logLevel: config_1.config.app.logLevel,
                },
            },
        };
    }
}
exports.TodoistSubtaskApp = TodoistSubtaskApp;
exports.app = new TodoistSubtaskApp();
if (require.main === module) {
    const main = async () => {
        try {
            console.log('🚀 Starting Todoist Subtask Generator...');
            await exports.app.initialize();
            const info = exports.app.getInfo();
            console.log(`\n📋 Application Info:`);
            console.log(`   Name: ${info.name}`);
            console.log(`   Version: ${info.version}`);
            console.log(`   Environment: ${info.environment}`);
            console.log(`   Todoist Rate Limit: ${info.config.todoist.rateLimit.requestsPerMinute}/min`);
            console.log(`   AI Models: ${info.config.openrouter.defaultModel} → ${info.config.openrouter.fallbackModel}`);
            const health = await exports.app.healthCheck();
            console.log(`\n🏥 Health Check:`);
            console.log(`   Status: ${health.status}`);
            console.log(`   Todoist: ${health.services.todoist}`);
            console.log(`   AI Service: ${health.services.ai}`);
            console.log(`   Rate Limiter: ${health.services.rateLimiter}`);
            console.log('\n✅ Application ready!');
            console.log('\n📝 Example Usage:');
            console.log('   const tasks = await app.getTasks();');
            console.log('   const candidates = await app.getSubtaskCandidates();');
            console.log('   const preview = await app.generateSubtaskPreview("task_id");');
            console.log('   const result = await app.createSubtasksFromTask("task_id");');
        }
        catch (error) {
            console.error('❌ Failed to start application:', error);
            process.exit(1);
        }
    };
    main();
}
//# sourceMappingURL=index.js.map