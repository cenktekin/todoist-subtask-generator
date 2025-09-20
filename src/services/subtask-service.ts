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
  additionalContext?: string;
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

      // Generate subtasks using AI with dynamic limit based on task complexity AND time
      const suggestedMaxSubtasks = this.estimateOptimalSubtaskCount(task.content, task.description, task.due?.date, options.additionalContext);
      const aiRequest: SubtaskGenerationRequest = {
        taskContent: task.content,
        taskDescription: task.description,
        dueDate: task.due?.date,
        maxSubtasks: suggestedMaxSubtasks,
        additionalContext: options.additionalContext,
      };

      const aiResponse = await this.aiService.generateSubtasks(aiRequest);

      // Tarihlendirme geçici olarak devre dışı - sadece AI'dan gelen subtask'ları kullan
      const distributedSubtasks = aiResponse.subtasks;

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
      const msg = error instanceof Error ? error.message : 'Unknown error';
      // Avoid stacking the phrase repeatedly
      if (msg.startsWith('Failed to create subtasks')) {
        throw error;
      }
      throw new Error(`Failed to create subtasks: ${msg}`);
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

      const suggestedMaxSubtasks = this.estimateOptimalSubtaskCount(task.content, task.description, task.due?.date, options.additionalContext);
      const aiRequest: SubtaskGenerationRequest = {
        taskContent: task.content,
        taskDescription: task.description,
        dueDate: task.due?.date,
        maxSubtasks: suggestedMaxSubtasks,
        additionalContext: options.additionalContext,
      };

      const aiResponse = await this.aiService.generateSubtasks(aiRequest);

      // Tarihlendirme geçici olarak devre dışı - sadece AI'dan gelen subtask'ları kullan
      let subtasks = aiResponse.subtasks;

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
    // Bu method geçici olarak kullanılmıyor ama gelecekte aktifleştirilebilir
    
    if (!dueDate) {
      // AI'dan gelen tarihleri koru
      return subtasks.map(subtask => ({
        ...subtask,
        due: subtask.due || undefined
      }));
    }

    const maxPerDay = options.maxSubtasksPerDay || 2;
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
      
      // Eğer AI zaten reasonable bir tarih vermiş ve o tarih bugünden sonraysa, onu koru
      if (subtask.due) {
        const aiDate = new Date(subtask.due);
        if (aiDate > today) {
          distributedSubtasks.push(subtask);
          continue;
        }
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

    return Math.max(1, days); // Bugün = bugün arası en az 1 gün olmalı
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
    // Local time zone'da format yapalım, GMT'ye çevirmeyelim
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Get tasks that are good candidates for subtask generation
  async getSubtaskCandidates(): Promise<TaskSummary[]> {
    return this.taskService.getTasksForSubtaskGeneration();
  }

  // Estimate optimal subtask count based on task complexity AND time available
  private estimateOptimalSubtaskCount(taskContent: string, taskDescription?: string, dueDate?: string, additionalContext?: string): number {
    const text = `${taskContent} ${taskDescription || ''}`.toLowerCase();
    const wordCount = text.split(/\s+/).length;
    
    // Keyword analysis for complexity
    const complexityKeywords = {
      high: ['proje', 'sistem', 'geliştir', 'oluştur', 'tasarla', 'analiz', 'araştır', 'öğren', 'eğitim', 'kurs', 'öğret', 'eğit'],
      medium: ['hazırla', 'planla', 'organize', 'düzenle', 'kontrol', 'test', 'gözden geçir', 'çalış', 'pratik'],
      low: ['gönder', 'ara', 'oku', 'yaz', 'kaydet', 'güncelle', 'sil', 'kontrol et']
    };
    
    let complexityScore = 0;
    
    // Analyze keywords
    complexityKeywords.high.forEach(keyword => {
      if (text.includes(keyword)) complexityScore += 3;
    });
    complexityKeywords.medium.forEach(keyword => {
      if (text.includes(keyword)) complexityScore += 2;
    });
    complexityKeywords.low.forEach(keyword => {
      if (text.includes(keyword)) complexityScore += 1;
    });
    
    // Word count factor
    let wordFactor = 0;
    if (wordCount > 50) wordFactor = 3;
    else if (wordCount > 20) wordFactor = 2;
    else if (wordCount > 10) wordFactor = 1;
    
    const complexityBasedScore = complexityScore + wordFactor;
    
    // TIME-BASED calculation (NEW!)
    let timeBasedCount = null;
    let totalDays = null;
    
    // First try to get days from due date
    if (dueDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endDate = new Date(dueDate);
      endDate.setHours(0, 0, 0, 0);
      
      totalDays = Math.max(1, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    }
    
    // If no meaningful due date, try to extract time from task description AND additional context (NEW!)
    if (!totalDays || totalDays <= 1) {
      const combinedText = `${taskContent} ${taskDescription || ''} ${additionalContext || ''}`;
      
      // Look for time patterns like "15 gün", "2 hafta", "1 ay", etc.
      const dayMatch = combinedText.match(/(\d+)\s*gün/i);
      const weekMatch = combinedText.match(/(\d+)\s*hafta/i);
      const monthMatch = combinedText.match(/(\d+)\s*ay/i);
      
      if (dayMatch) {
        totalDays = parseInt(dayMatch[1]);
        console.log(`Extracted ${totalDays} days from context: "${combinedText}"`);
      } else if (weekMatch) {
        totalDays = parseInt(weekMatch[1]) * 7;
        console.log(`Extracted ${weekMatch[1]} weeks = ${totalDays} days from context`);
      } else if (monthMatch) {
        totalDays = parseInt(monthMatch[1]) * 30;
        console.log(`Extracted ${monthMatch[1]} months = ${totalDays} days from context`);
      }
    }
    
    if (totalDays && totalDays > 1) {
      // Reasonable subtasks per day based on task type
      let subtasksPerDay = 1.5; // Default: günde 1-2 subtask arası
      
      // Adjust based on complexity keywords
      if (text.includes('eğitim') || text.includes('kurs') || text.includes('öğren')) {
        subtasksPerDay = 2; // Eğitim: günde 2 subtask (öğrenme yoğun)
      } else if (text.includes('proje') || text.includes('geliştir')) {
        subtasksPerDay = 2.5; // Proje: günde 2-3 subtask
      } else if (text.includes('araştır') || text.includes('analiz') || text.includes('plan')) {
        subtasksPerDay = 1; // Araştırma/Planlama: günde 1 subtask (derin düşünme)
      } else if (complexityScore >= 6) {
        subtasksPerDay = 1.5; // Complex tasks: daha az ama derin
      } else if (complexityScore <= 2) {
        subtasksPerDay = 3; // Simple tasks: günde daha fazla
      }
      
      timeBasedCount = Math.ceil(totalDays * subtasksPerDay);
      console.log(`Time analysis: ${totalDays} days * ${subtasksPerDay} subtasks/day = ${timeBasedCount} subtasks`);
    }
    
    // Complexity-based minimum count
    let complexityBasedCount;
    if (complexityBasedScore >= 8) complexityBasedCount = 15; // Very complex
    else if (complexityBasedScore >= 5) complexityBasedCount = 10; // Complex  
    else if (complexityBasedScore >= 3) complexityBasedCount = 6;  // Medium
    else if (complexityBasedScore >= 1) complexityBasedCount = 4;  // Simple
    else complexityBasedCount = 3; // Very simple
    
    // Final decision: use the HIGHER of time-based or complexity-based
    let finalCount;
    if (timeBasedCount !== null) {
      finalCount = Math.max(timeBasedCount, complexityBasedCount);
      console.log(`Task complexity analysis: time-based=${timeBasedCount}, complexity-based=${complexityBasedCount}, chosen=${finalCount}`);
    } else {
      finalCount = complexityBasedCount;
      console.log(`Task complexity analysis: no due date, using complexity-based=${finalCount}`);
    }
    
    // Apply max limit
    const result = Math.min(finalCount, config.subtaskGeneration.maxSubtasks);
    console.log(`Task complexity analysis: suggested max ${result} subtasks for "${taskContent.substring(0, 50)}..."`);
    
    return result;
  }

  // Estimate how many subtasks a task would generate (existing async version)
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