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
            const aiRequest = {
                taskContent: task.content,
                taskDescription: task.description,
                dueDate: task.due?.date,
                maxSubtasks: config_1.config.subtaskGeneration.maxSubtasks,
            };
            const aiResponse = await this.aiService.generateSubtasks(aiRequest);
            const distributedSubtasks = options.distributeByTime
                ? this.distributeSubtasksByDate(aiResponse.subtasks, task.due?.date, options)
                : aiResponse.subtasks;
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
            throw new Error(`Failed to create subtasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async generateSubtaskPreview(taskId, options = {}) {
        try {
            const taskDetails = await this.taskService.getTaskDetails(taskId);
            const task = taskDetails.task;
            const aiRequest = {
                taskContent: task.content,
                taskDescription: task.description,
                dueDate: task.due?.date,
                maxSubtasks: config_1.config.subtaskGeneration.maxSubtasks,
            };
            const aiResponse = await this.aiService.generateSubtasks(aiRequest);
            let subtasks = aiResponse.subtasks;
            if (options.distributeByTime) {
                subtasks = this.distributeSubtasksByDate(subtasks, task.due?.date, options);
            }
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
        const maxPerDay = options.maxSubtasksPerDay || 3;
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
                distributedSubtasks.push(subtask);
                continue;
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
        return Math.max(1, days - 1);
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
        return date.toISOString().split('T')[0];
    }
    async getSubtaskCandidates() {
        return this.taskService.getTasksForSubtaskGeneration();
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