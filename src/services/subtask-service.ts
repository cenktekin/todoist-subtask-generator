import { TodoistClient } from '../api/todoist-client';
import { AIService } from './ai-service';
import { TaskService, TaskSummary } from './task-service';
import {
  SubtaskGenerationRequest,
  SubtaskGenerationResponse,
  CreateTaskRequest,
  TodoistTask,
} from '../api/types';
import { config } from '../config/config';

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
}

export class SubtaskService {
  private todoistClient: TodoistClient;
  private aiService: AIService;
  private taskService: TaskService;

  constructor(
    todoistClient: TodoistClient,
    aiService: AIService,
    taskService: TaskService
  ) {
    this.todoistClient = todoistClient;
    this.aiService = aiService;
    this.taskService = taskService;
  }

  // Main method to create subtasks from a task
  async createSubtasksFromTask(
    taskId: string,
    options: SubtaskCreationOptions = {}
  ): Promise<SubtaskCreationResult> {
    try {
      // Get task details
      const taskDetails = await this.taskService.getTaskDetails(taskId);
      const task = taskDetails.task;

      // Generate subtasks using AI
      const aiRequest: SubtaskGenerationRequest = {
        taskContent: task.content,
        taskDescription: task.description,
        dueDate: task.due?.date,
        maxSubtasks: config.subtaskGeneration.maxSubtasks,
      };

      const aiResponse = await this.aiService.generateSubtasks(aiRequest);

      // Apply date distribution if needed
      const distributedSubtasks = options.distributeByTime
        ? this.distributeSubtasksByDate(
            aiResponse.subtasks,
            task.due?.date,
            options
          )
        : aiResponse.subtasks;

      // Apply priority strategy
      const prioritizedSubtasks = this.applyPriorityStrategy(
        distributedSubtasks,
        task.priority,
        options
      );

      // Create subtasks in Todoist
      const creationResults = await this.createSubtasksInTodoist(
        taskId,
        prioritizedSubtasks
      );

      return {
        taskId,
        subtasksCreated: creationResults.filter(r => r.todoistId).length,
        subtasks: creationResults,
        errors: creationResults.filter(r => r.error).map(r => r.error!),
        estimatedDuration: aiResponse.estimatedDuration,
      };
    } catch (error) {
      console.error('Failed to create subtasks from task:', error);
      throw new Error(`Failed to create subtasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Generate subtasks without creating them (preview mode)
  async generateSubtaskPreview(
    taskId: string,
    options: SubtaskCreationOptions = {}
  ): Promise<{
    subtasks: Array<{
      content: string;
      due?: string;
      priority?: number;
    }>;
    estimatedDuration: string;
  }> {
    try {
      const taskDetails = await this.taskService.getTaskDetails(taskId);
      const task = taskDetails.task;

      const aiRequest: SubtaskGenerationRequest = {
        taskContent: task.content,
        taskDescription: task.description,
        dueDate: task.due?.date,
        maxSubtasks: config.subtaskGeneration.maxSubtasks,
      };

      const aiResponse = await this.aiService.generateSubtasks(aiRequest);

      let subtasks = aiResponse.subtasks;

      if (options.distributeByTime) {
        subtasks = this.distributeSubtasksByDate(
          subtasks,
          task.due?.date,
          options
        );
      }

      subtasks = this.applyPriorityStrategy(subtasks, task.priority, options);

      return {
        subtasks,
        estimatedDuration: aiResponse.estimatedDuration,
      };
    } catch (error) {
      console.error('Failed to generate subtask preview:', error);
      throw new Error(`Failed to generate subtask preview: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Batch create subtasks for multiple tasks
  async createSubtasksForMultipleTasks(
    taskIds: string[],
    options: SubtaskCreationOptions = {}
  ): Promise<SubtaskCreationResult[]> {
    const results: SubtaskCreationResult[] = [];

    for (const taskId of taskIds) {
      try {
        const result = await this.createSubtasksFromTask(taskId, options);
        results.push(result);
        
        // Small delay between tasks to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Failed to create subtasks for task ${taskId}:`, error);
        results.push({
          taskId,
          subtasksCreated: 0,
          subtasks: [],
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          estimatedDuration: 'Unknown',
        });
      }
    }

    return results;
  }

  // Helper methods
  private distributeSubtasksByDate(
    subtasks: Array<{ content: string; due?: string; priority?: number }>,
    dueDate?: string,
    options: SubtaskCreationOptions = {}
  ): Array<{ content: string; due?: string; priority?: number }> {
    if (!dueDate) {
      // AI'dan gelen tarihleri koru
      return subtasks.map(subtask => ({
        ...subtask,
        due: subtask.due || undefined
      }));
    }

    const maxPerDay = options.maxSubtasksPerDay || 3;
    const includeWeekends = options.includeWeekends ?? false;
    const distribution = options.timeDistribution || 'equal';

    // Bugünden başlayarak ana görevin tarihine kadar olan süreyi hesapla
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(dueDate);
    endDate.setHours(0, 0, 0, 0);
    
    const totalDays = this.calculateDaysBetween(today, endDate, includeWeekends);

    if (totalDays <= 0) {
      // Eğer tarih bugün veya geçmişse, hepsini bugüne ata
      const todayStr = this.formatDate(today);
      return subtasks.map(subtask => ({ 
        ...subtask, 
        due: subtask.due || todayStr 
      }));
    }

    const distributedSubtasks = [];
    const subtasksPerDay = Math.ceil(subtasks.length / totalDays);

    for (let i = 0; i < subtasks.length; i++) {
      const subtask = { ...subtasks[i] };
      
      // AI'dan gelen tarih varsa onu koru, yoksa dağıt
      if (subtask.due) {
        distributedSubtasks.push(subtask);
        continue;
      }
      
      if (distribution === 'sequential') {
        const dayIndex = Math.floor(i / subtasksPerDay);
        const taskDate = this.addDaysToDate(today, dayIndex, includeWeekends);
        subtask.due = this.formatDate(taskDate);
      } else if (distribution === 'weighted') {
        // Weighted distribution - more important subtasks get earlier dates
        const priority = subtask.priority || 2;
        const dayIndex = Math.floor((i / subtasks.length) * totalDays * (5 - priority) / 4);
        const taskDate = this.addDaysToDate(today, dayIndex, includeWeekends);
        subtask.due = this.formatDate(taskDate);
      } else {
        // Equal distribution
        const dayIndex = Math.floor((i / subtasks.length) * totalDays);
        const taskDate = this.addDaysToDate(today, dayIndex, includeWeekends);
        subtask.due = this.formatDate(taskDate);
      }

      distributedSubtasks.push(subtask);
    }

    return distributedSubtasks;
  }

  private applyPriorityStrategy(
    subtasks: Array<{ content: string; due?: string; priority?: number }>,
    parentPriority: number,
    options: SubtaskCreationOptions = {}
  ): Array<{ content: string; due?: string; priority?: number }> {
    const strategy = options.priorityStrategy || 'inherit';

    switch (strategy) {
      case 'inherit':
        return subtasks.map(subtask => ({
          ...subtask,
          priority: parentPriority,
        }));

      case 'distribute':
        // Distribute priorities based on subtask position
        return subtasks.map((subtask, index) => {
          const priorityRange = 2; // Priority range to distribute across
          const minPriority = Math.max(1, parentPriority - Math.floor(priorityRange / 2));
          const maxPriority = Math.min(4, parentPriority + Math.floor(priorityRange / 2));
          
          const priority = minPriority + Math.floor((index / subtasks.length) * (maxPriority - minPriority));
          
          return {
            ...subtask,
            priority,
          };
        });

      case 'constant':
        const constantPriority = options.constantPriority || 2;
        return subtasks.map(subtask => ({
          ...subtask,
          priority: constantPriority,
        }));

      default:
        return subtasks;
    }
  }

  private async createSubtasksInTodoist(
    parentId: string,
    subtasks: Array<{ content: string; due?: string; priority?: number }>
  ): Promise<Array<{
    content: string;
    due?: string;
    priority?: number;
    todoistId?: string;
    error?: string;
  }>> {
    const results = [];

    for (const subtask of subtasks) {
      try {
        const createRequest: CreateTaskRequest = {
          content: subtask.content,
          parent_id: parentId,
          due: subtask.due ? { date: subtask.due } : undefined,
          priority: subtask.priority,
        };

        const createdTask = await this.todoistClient.createTask(createRequest);
        results.push({
          content: subtask.content,
          due: subtask.due,
          priority: subtask.priority,
          todoistId: createdTask.id,
        });
      } catch (error) {
        console.error('Failed to create subtask:', error);
        results.push({
          content: subtask.content,
          due: subtask.due,
          priority: subtask.priority,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Small delay between subtask creations
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return results;
  }

  // Utility methods
  private calculateDaysBetween(startDate: Date, endDate: Date, includeWeekends: boolean): number {
    let days = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      if (includeWeekends || currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
        days++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return Math.max(1, days - 1); // Subtract 1 to exclude the start date
  }

  private addDaysToDate(date: Date, days: number, includeWeekends: boolean): Date {
    const result = new Date(date);
    let daysAdded = 0;

    while (daysAdded < days) {
      result.setDate(result.getDate() + 1);
      
      if (includeWeekends || result.getDay() !== 0 && result.getDay() !== 6) {
        daysAdded++;
      }
    }

    return result;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  // Get tasks that are good candidates for subtask generation
  async getSubtaskCandidates(): Promise<TaskSummary[]> {
    return this.taskService.getTasksForSubtaskGeneration();
  }

  // Estimate how many subtasks a task would generate
  async estimateSubtaskCount(taskId: string): Promise<number> {
    try {
      const taskDetails = await this.taskService.getTaskDetails(taskId);
      const task = taskDetails.task;

      const prompt = `
Task: ${task.content}
${task.description ? `Description: ${task.description}` : ''}

Please estimate how many subtasks this task would break down into. Consider:
- Complexity of the task
- Number of distinct steps or actions
- Time required for completion

Return only the number as an integer.
`;

      const response = await this.aiService['callOpenAI'](
        'You are a task analysis expert. Estimate the number of subtasks needed.',
        prompt,
        config.openrouter.defaultModel
      );

      if (!response) {
        return 3; // Default estimate
      }

      const content = response.data.choices[0].message.content.trim();
      const estimatedCount = parseInt(content);
      
      return isNaN(estimatedCount) ? 3 : Math.max(1, Math.min(estimatedCount, config.subtaskGeneration.maxSubtasks));
    } catch (error) {
      console.error('Failed to estimate subtask count:', error);
      return 3; // Default estimate
    }
  }
}