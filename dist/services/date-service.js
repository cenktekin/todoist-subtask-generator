"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DateService = void 0;
const config_1 = require("../config/config");
class DateService {
    constructor() {
        this.defaultOptions = {
            workDayStart: '09:00',
            workDayEnd: '17:00',
            includeWeekends: false,
            dailyWorkHours: 8,
            bufferTime: 1,
            timezone: config_1.config.date.timezone,
        };
    }
    calculateTaskSchedule(taskContent, dueDate, subtasks, options = {}) {
        const mergedOptions = { ...this.defaultOptions, ...options };
        const workStart = this.parseTime(mergedOptions.workDayStart);
        const workEnd = this.parseTime(mergedOptions.workDayEnd);
        const dailyWorkHours = mergedOptions.dailyWorkHours;
        const totalEstimatedHours = subtasks.reduce((total, subtask) => {
            return total + (subtask.estimatedHours || this.estimateSubtaskDuration(subtask.content));
        }, 0);
        const schedule = this.calculateBackwardSchedule(dueDate, totalEstimatedHours, subtasks, mergedOptions);
        return {
            taskId: '',
            taskContent,
            startDate: schedule.startDate,
            endDate: schedule.endDate,
            subtasks: schedule.subtasks,
            totalDuration: totalEstimatedHours,
        };
    }
    calculateBackwardSchedule(dueDate, totalHours, subtasks, options) {
        const workStart = this.parseTime(options.workDayStart);
        const workEnd = this.parseTime(options.workDayEnd);
        const dailyWorkHours = options.dailyWorkHours;
        let currentDate = new Date(dueDate);
        currentDate.setHours(0, 0, 0, 0);
        currentDate.setDate(currentDate.getDate() - 1);
        const subtaskSchedules = [];
        let remainingHours = totalHours;
        let currentSubtaskIndex = subtasks.length - 1;
        while (remainingHours > 0 && currentSubtaskIndex >= 0) {
            const subtask = subtasks[currentSubtaskIndex];
            const subtaskHours = subtask.estimatedHours || this.estimateSubtaskDuration(subtask.content);
            const timeSlot = this.findAvailableTimeSlot(currentDate, subtaskHours, workStart, workEnd, options);
            if (timeSlot) {
                subtaskSchedules.unshift({
                    content: subtask.content,
                    dueDate: timeSlot.endDate,
                    duration: subtaskHours,
                });
                remainingHours -= subtaskHours;
                currentDate = timeSlot.startDate;
                currentSubtaskIndex--;
            }
            else {
                currentDate = this.getPreviousWorkDay(currentDate, options);
            }
        }
        return {
            startDate: currentDate,
            endDate: dueDate,
            subtasks: subtaskSchedules,
        };
    }
    findAvailableTimeSlot(date, requiredHours, workStart, workEnd, options) {
        const currentDay = new Date(date);
        currentDay.setHours(0, 0, 0, 0);
        if (!this.isWorkDay(currentDay, options)) {
            return null;
        }
        const availableHours = this.getAvailableWorkHours(currentDay, workStart, workEnd, options);
        if (availableHours >= requiredHours) {
            const startTime = this.calculateStartTime(currentDay, requiredHours, workStart, workEnd, options);
            const endTime = new Date(startTime);
            endTime.setHours(endTime.getHours() + requiredHours);
            return {
                startDate: startTime,
                endDate: endTime,
            };
        }
        return null;
    }
    calculateStartTime(date, duration, workStart, workEnd, options) {
        const startTime = new Date(date);
        startTime.setHours(workStart.hours, workStart.minutes, 0, 0);
        const availableHours = this.getAvailableWorkHours(date, workStart, workEnd, options);
        if (duration > availableHours) {
            return startTime;
        }
        const latestPossibleStart = new Date(date);
        latestPossibleStart.setHours(workEnd.hours - duration, workEnd.minutes, 0, 0);
        if (latestPossibleStart >= startTime) {
            return latestPossibleStart;
        }
        return startTime;
    }
    getAvailableWorkHours(date, workStart, workEnd, options) {
        if (!this.isWorkDay(date, options)) {
            return 0;
        }
        const start = new Date(date);
        start.setHours(workStart.hours, workStart.minutes, 0, 0);
        const end = new Date(date);
        end.setHours(workEnd.hours, workEnd.minutes, 0, 0);
        const diffMs = end.getTime() - start.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        return Math.max(0, diffHours);
    }
    isWorkDay(date, options) {
        if (options.includeWeekends) {
            return true;
        }
        const day = date.getDay();
        return day !== 0 && day !== 6;
    }
    getPreviousWorkDay(date, options) {
        const previousDay = new Date(date);
        previousDay.setDate(previousDay.getDate() - 1);
        while (!this.isWorkDay(previousDay, options)) {
            previousDay.setDate(previousDay.getDate() - 1);
        }
        return previousDay;
    }
    parseTime(timeString) {
        const [hours, minutes] = timeString.split(':').map(Number);
        return { hours, minutes };
    }
    estimateSubtaskDuration(content) {
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
    formatDateForTodoist(date) {
        return date.toISOString().split('T')[0];
    }
    formatDateTimeForTodoist(date) {
        return date.toISOString();
    }
    isOverdue(date) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);
        return checkDate < now;
    }
    getDaysBetween(startDate, endDate) {
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }
    addBusinessDays(date, days, options = this.defaultOptions) {
        const result = new Date(date);
        let daysAdded = 0;
        while (daysAdded < days) {
            result.setDate(result.getDate() + 1);
            if (this.isWorkDay(result, options)) {
                daysAdded++;
            }
        }
        return result;
    }
    getWorkDaysBetween(startDate, endDate, options = this.defaultOptions) {
        let workDays = 0;
        const current = new Date(startDate);
        while (current <= endDate) {
            if (this.isWorkDay(current, options)) {
                workDays++;
            }
            current.setDate(current.getDate() + 1);
        }
        return workDays;
    }
    calculateDueDate(startDate, durationInHours, options = this.defaultOptions) {
        const endDate = new Date(startDate);
        let remainingHours = durationInHours;
        let currentDay = new Date(startDate);
        while (remainingHours > 0) {
            if (this.isWorkDay(currentDay, options)) {
                const availableHours = this.getAvailableWorkHours(currentDay, this.parseTime(options.workDayStart), this.parseTime(options.workDayEnd), options);
                const hoursToday = Math.min(availableHours, remainingHours);
                remainingHours -= hoursToday;
                if (remainingHours > 0) {
                    currentDay.setDate(currentDay.getDate() + 1);
                }
            }
            else {
                currentDay.setDate(currentDay.getDate() + 1);
            }
        }
        return currentDay;
    }
    validateDateRange(startDate, endDate) {
        if (startDate > endDate) {
            return {
                isValid: false,
                error: 'Start date cannot be after end date',
            };
        }
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return {
                isValid: false,
                error: 'Invalid date format',
            };
        }
        return { isValid: true };
    }
    getWeekRange(date) {
        const startOfWeek = new Date(date);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        return { start: startOfWeek, end: endOfWeek };
    }
    getMonthRange(date) {
        const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);
        return { start: startOfMonth, end: endOfMonth };
    }
}
exports.DateService = DateService;
//# sourceMappingURL=date-service.js.map