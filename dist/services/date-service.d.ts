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
        duration: number;
    }>;
    totalDuration: number;
}
export interface SchedulingOptions {
    workDayStart: string;
    workDayEnd: string;
    includeWeekends: boolean;
    dailyWorkHours: number;
    bufferTime: number;
    timezone: string;
}
export declare class DateService {
    private defaultOptions;
    constructor();
    calculateTaskSchedule(taskContent: string, dueDate: Date, subtasks: Array<{
        content: string;
        estimatedHours?: number;
    }>, options?: Partial<SchedulingOptions>): TaskSchedule;
    private calculateBackwardSchedule;
    private findAvailableTimeSlot;
    private calculateStartTime;
    private getAvailableWorkHours;
    private isWorkDay;
    private getPreviousWorkDay;
    private parseTime;
    private estimateSubtaskDuration;
    formatDateForTodoist(date: Date): string;
    formatDateTimeForTodoist(date: Date): string;
    isOverdue(date: Date): boolean;
    getDaysBetween(startDate: Date, endDate: Date): number;
    addBusinessDays(date: Date, days: number, options?: SchedulingOptions): Date;
    getWorkDaysBetween(startDate: Date, endDate: Date, options?: SchedulingOptions): number;
    calculateDueDate(startDate: Date, durationInHours: number, options?: SchedulingOptions): Date;
    validateDateRange(startDate: Date, endDate: Date): {
        isValid: boolean;
        error?: string;
    };
    getWeekRange(date: Date): DateRange;
    getMonthRange(date: Date): DateRange;
}
//# sourceMappingURL=date-service.d.ts.map