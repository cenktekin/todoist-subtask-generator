import { config } from '../config/config';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface TaskSchedule {
  taskId: string;
  taskContent: string;
  startDate: Date;
  endDate: Date;
  subtasks: Array<{
    content: string;
    dueDate: Date;
    duration: number; // in hours
  }>;
  totalDuration: number; // in hours
}

export interface SchedulingOptions {
  workDayStart: string; // HH:mm format
  workDayEnd: string; // HH:mm format
  includeWeekends: boolean;
  dailyWorkHours: number;
  bufferTime: number; // hours between tasks
  timezone: string;
}

export class DateService {
  private defaultOptions: SchedulingOptions;

  constructor() {
    this.defaultOptions = {
      workDayStart: '09:00',
      workDayEnd: '17:00',
      includeWeekends: false,
      dailyWorkHours: 8,
      bufferTime: 1,
      timezone: config.date.timezone,
    };
  }

  // Calculate optimal schedule for subtasks based on due date
  calculateTaskSchedule(
    taskContent: string,
    dueDate: Date,
    subtasks: Array<{ content: string; estimatedHours?: number }>,
    options: Partial<SchedulingOptions> = {}
  ): TaskSchedule {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const workStart = this.parseTime(mergedOptions.workDayStart);
    const workEnd = this.parseTime(mergedOptions.workDayEnd);
    const dailyWorkHours = mergedOptions.dailyWorkHours;

    // Calculate total estimated duration
    const totalEstimatedHours = subtasks.reduce((total, subtask) => {
      return total + (subtask.estimatedHours || this.estimateSubtaskDuration(subtask.content));
    }, 0);

    // Calculate schedule backwards from due date
    const schedule = this.calculateBackwardSchedule(
      dueDate,
      totalEstimatedHours,
      subtasks,
      mergedOptions
    );

    return {
      taskId: '', // Will be set by caller
      taskContent,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      subtasks: schedule.subtasks,
      totalDuration: totalEstimatedHours,
    };
  }

  // Distribute subtasks across available time slots
  private calculateBackwardSchedule(
    dueDate: Date,
    totalHours: number,
    subtasks: Array<{ content: string; estimatedHours?: number }>,
    options: SchedulingOptions
  ): {
    startDate: Date;
    endDate: Date;
    subtasks: Array<{
      content: string;
      dueDate: Date;
      duration: number;
    }>;
  } {
    const workStart = this.parseTime(options.workDayStart);
    const workEnd = this.parseTime(options.workDayEnd);
    const dailyWorkHours = options.dailyWorkHours;

    let currentDate = new Date(dueDate);
    currentDate.setHours(0, 0, 0, 0);
    currentDate.setDate(currentDate.getDate() - 1); // Start day before due date

    const subtaskSchedules = [];
    let remainingHours = totalHours;
    let currentSubtaskIndex = subtasks.length - 1; // Start from last subtask

    while (remainingHours > 0 && currentSubtaskIndex >= 0) {
      const subtask = subtasks[currentSubtaskIndex];
      const subtaskHours = subtask.estimatedHours || this.estimateSubtaskDuration(subtask.content);

      // Find available time slot for this subtask
      const timeSlot = this.findAvailableTimeSlot(
        currentDate,
        subtaskHours,
        workStart,
        workEnd,
        options
      );

      if (timeSlot) {
        subtaskSchedules.unshift({
          content: subtask.content,
          dueDate: timeSlot.endDate,
          duration: subtaskHours,
        });

        remainingHours -= subtaskHours;
        currentDate = timeSlot.startDate;
        currentSubtaskIndex--;
      } else {
        // No more time available, move to previous day
        currentDate = this.getPreviousWorkDay(currentDate, options);
      }
    }

    return {
      startDate: currentDate,
      endDate: dueDate,
      subtasks: subtaskSchedules,
    };
  }

  // Find available time slot for a subtask
  private findAvailableTimeSlot(
    date: Date,
    requiredHours: number,
    workStart: { hours: number; minutes: number },
    workEnd: { hours: number; minutes: number },
    options: SchedulingOptions
  ): { startDate: Date; endDate: Date } | null {
    const currentDay = new Date(date);
    currentDay.setHours(0, 0, 0, 0);

    // Check if this is a work day
    if (!this.isWorkDay(currentDay, options)) {
      return null;
    }

    // Calculate available hours in this day
    const availableHours = this.getAvailableWorkHours(
      currentDay,
      workStart,
      workEnd,
      options
    );

    if (availableHours >= requiredHours) {
      const startTime = this.calculateStartTime(
        currentDay,
        requiredHours,
        workStart,
        workEnd,
        options
      );

      const endTime = new Date(startTime);
      endTime.setHours(endTime.getHours() + requiredHours);

      return {
        startDate: startTime,
        endDate: endTime,
      };
    }

    return null;
  }

  // Calculate start time for a subtask
  private calculateStartTime(
    date: Date,
    duration: number,
    workStart: { hours: number; minutes: number },
    workEnd: { hours: number; minutes: number },
    options: SchedulingOptions
  ): Date {
    const startTime = new Date(date);
    startTime.setHours(workStart.hours, workStart.minutes, 0, 0);

    // If we need to split across days, start at the beginning of the day
    const availableHours = this.getAvailableWorkHours(date, workStart, workEnd, options);
    if (duration > availableHours) {
      return startTime;
    }

    // Try to place the task as late as possible (backward scheduling)
    const latestPossibleStart = new Date(date);
    latestPossibleStart.setHours(workEnd.hours - duration, workEnd.minutes, 0, 0);

    if (latestPossibleStart >= startTime) {
      return latestPossibleStart;
    }

    return startTime;
  }

  // Get available work hours for a day
  private getAvailableWorkHours(
    date: Date,
    workStart: { hours: number; minutes: number },
    workEnd: { hours: number; minutes: number },
    options: SchedulingOptions
  ): number {
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

  // Check if a date is a work day
  private isWorkDay(date: Date, options: SchedulingOptions): boolean {
    if (options.includeWeekends) {
      return true;
    }

    const day = date.getDay();
    return day !== 0 && day !== 6; // Not Sunday (0) or Saturday (6)
  }

  // Get previous work day
  private getPreviousWorkDay(date: Date, options: SchedulingOptions): Date {
    const previousDay = new Date(date);
    previousDay.setDate(previousDay.getDate() - 1);

    while (!this.isWorkDay(previousDay, options)) {
      previousDay.setDate(previousDay.getDate() - 1);
    }

    return previousDay;
  }

  // Parse time string (HH:mm) to hours and minutes
  private parseTime(timeString: string): { hours: number; minutes: number } {
    const [hours, minutes] = timeString.split(':').map(Number);
    return { hours, minutes };
  }

  // Estimate subtask duration based on content
  private estimateSubtaskDuration(content: string): number {
    const words = content.split(' ').length;
    
    // Simple estimation based on word count
    if (words <= 5) return 0.5; // 30 minutes
    if (words <= 10) return 1; // 1 hour
    if (words <= 20) return 2; // 2 hours
    if (words <= 50) return 4; // 4 hours
    return 8; // 8 hours max
  }

  // Format date for Todoist API
  formatDateForTodoist(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  // Format datetime for Todoist API
  formatDateTimeForTodoist(date: Date): string {
    return date.toISOString();
  }

  // Check if a date is overdue
  isOverdue(date: Date): boolean {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Reset time to start of day
    
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    return checkDate < now;
  }

  // Get days between two dates
  getDaysBetween(startDate: Date, endDate: Date): number {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  // Add business days to a date
  addBusinessDays(date: Date, days: number, options: SchedulingOptions = this.defaultOptions): Date {
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

  // Get work days between two dates
  getWorkDaysBetween(startDate: Date, endDate: Date, options: SchedulingOptions = this.defaultOptions): number {
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

  // Calculate optimal due date based on start date and duration
  calculateDueDate(
    startDate: Date,
    durationInHours: number,
    options: SchedulingOptions = this.defaultOptions
  ): Date {
    const endDate = new Date(startDate);
    let remainingHours = durationInHours;
    let currentDay = new Date(startDate);

    while (remainingHours > 0) {
      if (this.isWorkDay(currentDay, options)) {
        const availableHours = this.getAvailableWorkHours(
          currentDay,
          this.parseTime(options.workDayStart),
          this.parseTime(options.workDayEnd),
          options
        );

        const hoursToday = Math.min(availableHours, remainingHours);
        remainingHours -= hoursToday;

        if (remainingHours > 0) {
          currentDay.setDate(currentDay.getDate() + 1);
        }
      } else {
        currentDay.setDate(currentDay.getDate() + 1);
      }
    }

    return currentDay;
  }

  // Validate date range
  validateDateRange(startDate: Date, endDate: Date): { isValid: boolean; error?: string } {
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

  // Get date range for a week
  getWeekRange(date: Date): DateRange {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return { start: startOfWeek, end: endOfWeek };
  }

  // Get date range for a month
  getMonthRange(date: Date): DateRange {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    return { start: startOfMonth, end: endOfMonth };
  }
}