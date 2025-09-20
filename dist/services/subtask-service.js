"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubtaskService = void 0;
const config_1 = require("../config/config");
class SubtaskService {
    constructor(todoistClient, aiService, taskService) {
        this.todoistClient = todoistClient;
        this.aiService = aiService;
        this.taskService = taskService;
    }
    async createSubtasksFromTask(taskId, options = {}) {
        try {
            const taskDetails = await this.taskService.getTaskDetails(taskId);
            const task = taskDetails.task;
            const suggestedMaxSubtasks = this.estimateOptimalSubtaskCount(task.content, task.description, task.due?.date, options.additionalContext);
            const aiRequest = {
                taskContent: task.content,
                taskDescription: task.description,
                dueDate: task.due?.date,
                maxSubtasks: suggestedMaxSubtasks,
                additionalContext: options.additionalContext,
            };
            const aiResponse = await this.aiService.generateSubtasks(aiRequest);
            const distributedSubtasks = aiResponse.subtasks;
            const prioritizedSubtasks = this.applyPriorityStrategy(distributedSubtasks, task.priority, options);
            const creationResults = await this.createSubtasksInTodoist(taskId, prioritizedSubtasks);
            return {
                taskId,
                subtasksCreated: creationResults.filter(r => r.todoistId).length,
                subtasks: creationResults,
                errors: creationResults.filter(r => r.error).map(r => r.error),
                estimatedDuration: aiResponse.estimatedDuration,
            };
        }
        catch (error) {
            console.error('Failed to create subtasks from task:', error);
            const msg = error instanceof Error ? error.message : 'Unknown error';
            if (msg.startsWith('Failed to create subtasks')) {
                throw error;
            }
            throw new Error(`Failed to create subtasks: ${msg}`);
        }
    }
    async generateSubtaskPreview(taskId, options = {}) {
        try {
            const taskDetails = await this.taskService.getTaskDetails(taskId);
            const task = taskDetails.task;
            const suggestedMaxSubtasks = this.estimateOptimalSubtaskCount(task.content, task.description, task.due?.date, options.additionalContext);
            const aiRequest = {
                taskContent: task.content,
                taskDescription: task.description,
                dueDate: task.due?.date,
                maxSubtasks: suggestedMaxSubtasks,
                additionalContext: options.additionalContext,
            };
            const aiResponse = await this.aiService.generateSubtasks(aiRequest);
            let subtasks = aiResponse.subtasks;
            subtasks = this.applyPriorityStrategy(subtasks, task.priority, options);
            return {
                subtasks,
                estimatedDuration: aiResponse.estimatedDuration,
            };
        }
        catch (error) {
            console.error('Failed to generate subtask preview:', error);
            throw new Error(`Failed to generate subtask preview: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async createSubtasksForMultipleTasks(taskIds, options = {}) {
        const results = [];
        for (const taskId of taskIds) {
            try {
                const result = await this.createSubtasksFromTask(taskId, options);
                results.push(result);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            catch (error) {
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
    distributeSubtasksByDate(subtasks, dueDate, options = {}) {
        if (!dueDate) {
            return subtasks.map(subtask => ({
                ...subtask,
                due: subtask.due || undefined
            }));
        }
        const maxPerDay = options.maxSubtasksPerDay || 2;
        const includeWeekends = options.includeWeekends ?? false;
        const distribution = options.timeDistribution || 'equal';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date(dueDate);
        endDate.setHours(0, 0, 0, 0);
        const totalDays = this.calculateDaysBetween(today, endDate, includeWeekends);
        if (totalDays <= 0) {
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
            }
            else if (distribution === 'weighted') {
                const priority = subtask.priority || 2;
                const dayIndex = Math.floor((i / subtasks.length) * totalDays * (5 - priority) / 4);
                const taskDate = this.addDaysToDate(today, dayIndex, includeWeekends);
                subtask.due = this.formatDate(taskDate);
            }
            else {
                const dayIndex = Math.floor((i / subtasks.length) * totalDays);
                const taskDate = this.addDaysToDate(today, dayIndex, includeWeekends);
                subtask.due = this.formatDate(taskDate);
            }
            distributedSubtasks.push(subtask);
        }
        return distributedSubtasks;
    }
    applyPriorityStrategy(subtasks, parentPriority, options = {}) {
        const strategy = options.priorityStrategy || 'inherit';
        switch (strategy) {
            case 'inherit':
                return subtasks.map(subtask => ({
                    ...subtask,
                    priority: parentPriority,
                }));
            case 'distribute':
                return subtasks.map((subtask, index) => {
                    const priorityRange = 2;
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
    async createSubtasksInTodoist(parentId, subtasks) {
        const results = [];
        for (const subtask of subtasks) {
            try {
                const createRequest = {
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
            }
            catch (error) {
                console.error('Failed to create subtask:', error);
                results.push({
                    content: subtask.content,
                    due: subtask.due,
                    priority: subtask.priority,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        return results;
    }
    calculateDaysBetween(startDate, endDate, includeWeekends) {
        let days = 0;
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            if (includeWeekends || currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
                days++;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return Math.max(1, days);
    }
    addDaysToDate(date, days, includeWeekends) {
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
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    async getSubtaskCandidates() {
        return this.taskService.getTasksForSubtaskGeneration();
    }
    estimateOptimalSubtaskCount(taskContent, taskDescription, dueDate, additionalContext) {
        const text = `${taskContent} ${taskDescription || ''}`.toLowerCase();
        const wordCount = text.split(/\s+/).length;
        const complexityKeywords = {
            high: ['proje', 'sistem', 'geliştir', 'oluştur', 'tasarla', 'analiz', 'araştır', 'öğren', 'eğitim', 'kurs', 'öğret', 'eğit'],
            medium: ['hazırla', 'planla', 'organize', 'düzenle', 'kontrol', 'test', 'gözden geçir', 'çalış', 'pratik'],
            low: ['gönder', 'ara', 'oku', 'yaz', 'kaydet', 'güncelle', 'sil', 'kontrol et']
        };
        let complexityScore = 0;
        complexityKeywords.high.forEach(keyword => {
            if (text.includes(keyword))
                complexityScore += 3;
        });
        complexityKeywords.medium.forEach(keyword => {
            if (text.includes(keyword))
                complexityScore += 2;
        });
        complexityKeywords.low.forEach(keyword => {
            if (text.includes(keyword))
                complexityScore += 1;
        });
        let wordFactor = 0;
        if (wordCount > 50)
            wordFactor = 3;
        else if (wordCount > 20)
            wordFactor = 2;
        else if (wordCount > 10)
            wordFactor = 1;
        const complexityBasedScore = complexityScore + wordFactor;
        let timeBasedCount = null;
        let totalDays = null;
        if (dueDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const endDate = new Date(dueDate);
            endDate.setHours(0, 0, 0, 0);
            totalDays = Math.max(1, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
        }
        if (!totalDays || totalDays <= 1) {
            const combinedText = `${taskContent} ${taskDescription || ''} ${additionalContext || ''}`;
            const dayMatch = combinedText.match(/(\d+)\s*gün/i);
            const weekMatch = combinedText.match(/(\d+)\s*hafta/i);
            const monthMatch = combinedText.match(/(\d+)\s*ay/i);
            if (dayMatch) {
                totalDays = parseInt(dayMatch[1]);
                console.log(`Extracted ${totalDays} days from context: "${combinedText}"`);
            }
            else if (weekMatch) {
                totalDays = parseInt(weekMatch[1]) * 7;
                console.log(`Extracted ${weekMatch[1]} weeks = ${totalDays} days from context`);
            }
            else if (monthMatch) {
                totalDays = parseInt(monthMatch[1]) * 30;
                console.log(`Extracted ${monthMatch[1]} months = ${totalDays} days from context`);
            }
        }
        if (totalDays && totalDays > 1) {
            let subtasksPerDay = 1.5;
            if (text.includes('eğitim') || text.includes('kurs') || text.includes('öğren')) {
                subtasksPerDay = 2;
            }
            else if (text.includes('proje') || text.includes('geliştir')) {
                subtasksPerDay = 2.5;
            }
            else if (text.includes('araştır') || text.includes('analiz') || text.includes('plan')) {
                subtasksPerDay = 1;
            }
            else if (complexityScore >= 6) {
                subtasksPerDay = 1.5;
            }
            else if (complexityScore <= 2) {
                subtasksPerDay = 3;
            }
            timeBasedCount = Math.ceil(totalDays * subtasksPerDay);
            console.log(`Time analysis: ${totalDays} days * ${subtasksPerDay} subtasks/day = ${timeBasedCount} subtasks`);
        }
        let complexityBasedCount;
        if (complexityBasedScore >= 8)
            complexityBasedCount = 15;
        else if (complexityBasedScore >= 5)
            complexityBasedCount = 10;
        else if (complexityBasedScore >= 3)
            complexityBasedCount = 6;
        else if (complexityBasedScore >= 1)
            complexityBasedCount = 4;
        else
            complexityBasedCount = 3;
        let finalCount;
        if (timeBasedCount !== null) {
            finalCount = Math.max(timeBasedCount, complexityBasedCount);
            console.log(`Task complexity analysis: time-based=${timeBasedCount}, complexity-based=${complexityBasedCount}, chosen=${finalCount}`);
        }
        else {
            finalCount = complexityBasedCount;
            console.log(`Task complexity analysis: no due date, using complexity-based=${finalCount}`);
        }
        const result = Math.min(finalCount, config_1.config.subtaskGeneration.maxSubtasks);
        console.log(`Task complexity analysis: suggested max ${result} subtasks for "${taskContent.substring(0, 50)}..."`);
        return result;
    }
    async estimateSubtaskCount(taskId) {
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
            const response = await this.aiService['callOpenAI']('You are a task analysis expert. Estimate the number of subtasks needed.', prompt, config_1.config.openrouter.defaultModel);
            if (!response) {
                return 3;
            }
            const content = response.data.choices[0].message.content.trim();
            const estimatedCount = parseInt(content);
            return isNaN(estimatedCount) ? 3 : Math.max(1, Math.min(estimatedCount, config_1.config.subtaskGeneration.maxSubtasks));
        }
        catch (error) {
            console.error('Failed to estimate subtask count:', error);
            return 3;
        }
    }
}
exports.SubtaskService = SubtaskService;
//# sourceMappingURL=subtask-service.js.map