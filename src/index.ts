import { TodoistClient } from './api/todoist-client';
import { AIService } from './services/ai-service';
import { TaskService } from './services/task-service';
import { SubtaskService } from './services/subtask-service';
import { DateService } from './services/date-service';
import { errorHandler, ErrorType } from './utils/error-handler';
import { rateLimiter } from './utils/rate-limiter';
import { config, validateConfig } from './config/config';
import winston from 'winston';

// Logger setup
const logger = winston.createLogger({
  level: config.app.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Global error handling
errorHandler.onError(ErrorType.UNKNOWN_ERROR, (error) => {
  logger.error('Global error handler:', error);
});

errorHandler.onError(ErrorType.API_ERROR, (error) => {
  logger.warn('API error:', error);
});

errorHandler.onError(ErrorType.RATE_LIMIT_ERROR, (error) => {
  logger.warn('Rate limit exceeded:', error);
});

// Rate limit monitoring
rateLimiter.setRateLimitCallback((info) => {
  logger.warn('Rate limit info:', info);
});

rateLimiter.setQuotaCallback((info) => {
  logger.warn('Quota info:', info);
});

export class TodoistSubtaskApp {
  private todoistClient: TodoistClient;
  private aiService: AIService;
  private taskService: TaskService;
  private subtaskService: SubtaskService;
  private dateService: DateService;

  constructor() {
    try {
      validateConfig();
      
      this.todoistClient = new TodoistClient();
      this.aiService = new AIService();
      this.taskService = new TaskService(this.todoistClient);
      this.subtaskService = new SubtaskService(this.todoistClient, this.aiService, this.taskService);
      this.dateService = new DateService();

      logger.info('Todoist Subtask Generator initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize application:', error);
      throw error;
    }
  }

  // Main application methods
  async initialize(): Promise<void> {
    try {
      // Test API connections
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
    } catch (error) {
      logger.error('Initialization failed:', error);
      throw error;
    }
  }

  async testTodoistConnection(): Promise<boolean> {
    try {
      const user = await this.todoistClient.getUser();
      logger.info(`Connected to Todoist as: ${user.name}`);
      return true;
    } catch (error) {
      logger.error('Todoist connection failed:', error);
      return false;
    }
  }

  async testAIConnection(): Promise<boolean> {
    try {
      const connected = await this.aiService.testConnection();
      if (connected) {
        logger.info('AI service connection successful');
      } else {
        logger.warn('AI service connection failed');
      }
      return connected;
    } catch (error) {
      logger.error('AI connection test failed:', error);
      return false;
    }
  }

  // Task management methods
  async getTasks(filters?: any): Promise<any[]> {
    try {
      return await rateLimiter.executeWithRateLimit(async () => {
        const tasks = await this.taskService.getTasksWithFilters(filters);
        logger.info(`Retrieved ${tasks.length} tasks`);
        return tasks;
      });
    } catch (error) {
      logger.error('Failed to get tasks:', error);
      throw error;
    }
  }

  async getProjects(): Promise<any[]> {
    try {
      return await rateLimiter.executeWithRateLimit(async () => {
        const projects = await this.todoistClient.getProjects();
        logger.info(`Retrieved ${projects.length} projects`);
        return projects;
      });
    } catch (error) {
      logger.error('Failed to get projects:', error);
      throw error;
    }
  }

  async getLabels(): Promise<any[]> {
    try {
      return await rateLimiter.executeWithRateLimit(async () => {
        const labels = await this.todoistClient.getLabels();
        logger.info(`Retrieved ${labels.length} labels`);
        return labels;
      });
    } catch (error) {
      logger.error('Failed to get labels:', error);
      throw error;
    }
  }

  async getTaskStatistics(): Promise<any> {
    try {
      return await rateLimiter.executeWithRateLimit(async () => {
        const stats = await this.taskService.getTaskStatistics();
        logger.info('Retrieved task statistics');
        return stats;
      });
    } catch (error) {
      logger.error('Failed to get task statistics:', error);
      throw error;
    }
  }

  // Subtask generation methods
  async generateSubtaskPreview(taskId: string, options?: any): Promise<any> {
    try {
      return await rateLimiter.executeWithRateLimit(async () => {
        const preview = await this.subtaskService.generateSubtaskPreview(taskId, options);
        logger.info(`Generated subtask preview for task ${taskId}`);
        return preview;
      });
    } catch (error) {
      logger.error('Failed to generate subtask preview:', error);
      throw error;
    }
  }

  async createSubtasksFromTask(taskId: string, options?: any): Promise<any> {
    try {
      return await rateLimiter.executeWithRateLimit(async () => {
        const result = await this.subtaskService.createSubtasksFromTask(taskId, options);
        logger.info(`Created ${result.subtasksCreated} subtasks for task ${taskId}`);
        return result;
      });
    } catch (error) {
      logger.error('Failed to create subtasks:', error);
      throw error;
    }
  }

  async createSubtasksForMultipleTasks(taskIds: string[], options?: any): Promise<any[]> {
    try {
      return await rateLimiter.executeWithRateLimit(async () => {
        const results = await this.subtaskService.createSubtasksForMultipleTasks(taskIds, options);
        const totalCreated = results.reduce((sum, result) => sum + result.subtasksCreated, 0);
        logger.info(`Created ${totalCreated} subtasks for ${taskIds.length} tasks`);
        return results;
      });
    } catch (error) {
      logger.error('Failed to create subtasks for multiple tasks:', error);
      throw error;
    }
  }

  // Date scheduling methods
  async calculateTaskSchedule(taskId: string, options?: any): Promise<any> {
    try {
      const taskDetails = await this.taskService.getTaskDetails(taskId);
      const task = taskDetails.task;

      // Önce mevcut subtask'ları kontrol et
      const existingSubtasks = taskDetails.subtasks || [];
      let subtasksWithDuration = [];

      if (existingSubtasks.length > 0) {
        // Mevcut subtask'lar varsa onları kullan
        subtasksWithDuration = existingSubtasks.map(st => {
          const estimatedHours = this.estimateTaskDuration(st.content);
          return { 
            content: st.content, 
            estimatedHours,
            due: st.due?.date,
            priority: st.priority 
          };
        });
      } else {
        // Mevcut subtask yoksa AI ile oluştur
        const aiRequest = {
          taskContent: task.content,
          taskDescription: task.description,
          dueDate: task.due?.date,
          maxSubtasks: 5, // Limit for scheduling preview
        };

        const aiResponse = await this.aiService.generateSubtasks(aiRequest);

        // Estimate task durations based on content
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

      // Calculate schedule
      const schedule = this.dateService.calculateTaskSchedule(
        task.content,
        task.due?.date ? new Date(task.due.date) : new Date(),
        subtasksWithDuration,
        {
          workDayStart: '09:00',
          workDayEnd: '17:00',
          includeWeekends: false,
          dailyWorkHours: 8,
          bufferTime: 1,
          timezone: config.date.timezone,
          ...options
        }
      );

      // Format schedule for web interface
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
    } catch (error) {
      logger.error('Failed to calculate task schedule:', error);
      throw error;
    }
  }

  // Helper method to estimate task duration based on content
  private estimateTaskDuration(content: string): number {
    const words = content.split(' ').length;
    
    // Simple estimation based on word count and task complexity
    if (words <= 5) return 0.5; // 30 minutes
    if (words <= 10) return 1; // 1 hour
    if (words <= 20) return 2; // 2 hours
    if (words <= 50) return 4; // 4 hours
    return 8; // 8 hours max
  }

  // Helper method to calculate task priority based on content and position
  private calculateTaskPriority(content: string, index: number, total: number): number {
    // Priority based on content keywords
    const highPriorityKeywords = ['acil', 'öncelikli', 'kritik', 'hızlı', 'teslim'];
    const mediumPriorityKeywords = ['planla', 'hazırla', 'kontrol', 'gönder', 'araştır'];
    
    const contentLower = content.toLowerCase();
    
    if (highPriorityKeywords.some(keyword => contentLower.includes(keyword))) {
      return 1; // High priority
    }
    
    if (mediumPriorityKeywords.some(keyword => contentLower.includes(keyword))) {
      return 2; // Medium priority
    }
    
    // Priority based on position (earlier tasks get higher priority)
    if (index < total * 0.3) {
      return 2; // Early tasks - medium priority
    } else if (index < total * 0.7) {
      return 3; // Middle tasks - normal priority
    } else {
      return 4; // Late tasks - low priority
    }
  }

  // Utility methods
  async getSubtaskCandidates(): Promise<any[]> {
    try {
      return await rateLimiter.executeWithRateLimit(async () => {
        const candidates = await this.subtaskService.getSubtaskCandidates();
        logger.info(`Found ${candidates.length} subtask candidates`);
        return candidates;
      });
    } catch (error) {
      logger.error('Failed to get subtask candidates:', error);
      throw error;
    }
  }

  async estimateSubtaskCount(taskId: string): Promise<number> {
    try {
      return await rateLimiter.executeWithRateLimit(async () => {
        const count = await this.subtaskService.estimateSubtaskCount(taskId);
        logger.info(`Estimated ${count} subtasks for task ${taskId}`);
        return count;
      });
    } catch (error) {
      logger.error('Failed to estimate subtask count:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      todoist: 'up' | 'down' | 'degraded';
      ai: 'up' | 'down' | 'degraded';
      rateLimiter: 'up' | 'down';
    };
    timestamp: Date;
  }> {
    const healthCheck = {
      status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      services: {
        todoist: 'up' as 'up' | 'down' | 'degraded',
        ai: 'up' as 'up' | 'down' | 'degraded',
        rateLimiter: 'up' as 'up' | 'down',
      },
      timestamp: new Date(),
    };

    try {
      // Check Todoist
      try {
        await this.todoistClient.getUser();
        healthCheck.services.todoist = 'up';
      } catch (error) {
        healthCheck.services.todoist = 'down';
        healthCheck.status = 'unhealthy';
      }

      // Check AI service
      try {
        const connected = await this.aiService.testConnection();
        healthCheck.services.ai = connected ? 'up' : 'down';
        if (!connected) {
          healthCheck.status = 'degraded';
        }
      } catch (error) {
        healthCheck.services.ai = 'down';
        healthCheck.status = 'unhealthy';
      }

      // Check rate limiter
      try {
        const stats = rateLimiter.getStats();
        healthCheck.services.rateLimiter = 'up';
        
        // Check if rate limiter is under stress
        if (stats.queuedRequests > 10 || stats.activeRequests >= 8) {
          healthCheck.status = 'degraded';
        }
      } catch (error) {
        healthCheck.services.rateLimiter = 'down';
        healthCheck.status = 'unhealthy';
      }

      logger.info('Health check completed:', healthCheck);
      return healthCheck;
    } catch (error) {
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

  // Get application info
  getInfo(): {
    name: string;
    version: string;
    environment: string;
    config: {
      todoist: { rateLimit: any };
      openrouter: { defaultModel: string; fallbackModel: string };
      app: { port: number; logLevel: string };
    };
  } {
    return {
      name: 'Todoist Subtask Generator',
      version: '1.0.0',
      environment: config.app.environment,
      config: {
        todoist: {
          rateLimit: config.todoist.rateLimit,
        },
        openrouter: {
          defaultModel: config.openrouter.defaultModel,
          fallbackModel: config.openrouter.fallbackModel,
        },
        app: {
          port: config.app.port,
          logLevel: config.app.logLevel,
        },
      },
    };
  }
}

// Create and export the application instance
export const app = new TodoistSubtaskApp();

// CLI interface
if (require.main === module) {
  const main = async () => {
    try {
      console.log('🚀 Starting Todoist Subtask Generator...');
      
      // Initialize the application
      await app.initialize();
      
      // Display application info
      const info = app.getInfo();
      console.log(`\n📋 Application Info:`);
      console.log(`   Name: ${info.name}`);
      console.log(`   Version: ${info.version}`);
      console.log(`   Environment: ${info.environment}`);
      console.log(`   Todoist Rate Limit: ${info.config.todoist.rateLimit.requestsPerMinute}/min`);
      console.log(`   AI Models: ${info.config.openrouter.defaultModel} → ${info.config.openrouter.fallbackModel}`);
      
      // Perform health check
      const health = await app.healthCheck();
      console.log(`\n🏥 Health Check:`);
      console.log(`   Status: ${health.status}`);
      console.log(`   Todoist: ${health.services.todoist}`);
      console.log(`   AI Service: ${health.services.ai}`);
      console.log(`   Rate Limiter: ${health.services.rateLimiter}`);
      
      console.log('\n✅ Application ready!');
      
      // Example usage
      console.log('\n📝 Example Usage:');
      console.log('   const tasks = await app.getTasks();');
      console.log('   const candidates = await app.getSubtaskCandidates();');
      console.log('   const preview = await app.generateSubtaskPreview("task_id");');
      console.log('   const result = await app.createSubtasksFromTask("task_id");');
      
    } catch (error) {
      console.error('❌ Failed to start application:', error);
      process.exit(1);
    }
  };

  main();
}