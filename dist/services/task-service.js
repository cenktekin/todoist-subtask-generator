"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskService = void 0;
class TaskService {
    constructor(todoistClient) {
        this.todoistClient = todoistClient;
    }
    async getTasksWithFilters(filters = {}) {
        try {
            let tasks = await this.todoistClient.getTasks();
            if (filters.projectId) {
                tasks = tasks.filter(task => task.project_id === filters.projectId);
            }
            if (filters.label) {
                tasks = tasks.filter(task => task.labels.includes(filters.label));
            }
            if (filters.priority) {
                tasks = tasks.filter(task => task.priority === filters.priority);
            }
            if (filters.dueDate) {
                console.log('DEBUG: filtering tasks with:', JSON.stringify(filters));
                console.log('DEBUG: total tasks before filtering:', tasks.length);
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                console.log('DEBUG: today date for comparison:', now.toISOString());
                const today = now.toISOString().split('T')[0];
                if (filters.dueDate.from) {
                    const beforeFilter = tasks.length;
                    tasks = tasks.filter(task => {
                        if (!task.due?.date)
                            return false;
                        const taskDate = task.due.date.split('T')[0];
                        return taskDate >= filters.dueDate.from;
                    });
                    console.log(`Filter by from date (${filters.dueDate.from}): ${beforeFilter} -> ${tasks.length} tasks`);
                }
                if (filters.dueDate.to) {
                    const beforeFilter = tasks.length;
                    tasks = tasks.filter(task => {
                        if (!task.due?.date)
                            return false;
                        const taskDate = task.due.date.split('T')[0];
                        return taskDate <= filters.dueDate.to;
                    });
                    console.log(`Filter by to date (${filters.dueDate.to}): ${beforeFilter} -> ${tasks.length} tasks`);
                }
            }
            if (filters.status) {
                switch (filters.status) {
                    case 'active':
                        tasks = tasks.filter(task => !task.checked);
                        break;
                    case 'completed':
                        tasks = tasks.filter(task => task.checked);
                        break;
                }
            }
            if (filters.searchQuery) {
                const query = filters.searchQuery.toLowerCase();
                tasks = tasks.filter(task => task.content.toLowerCase().includes(query) ||
                    (task.description && task.description.toLowerCase().includes(query)));
            }
            const [projects, labels] = await Promise.all([
                this.todoistClient.getProjects(),
                this.todoistClient.getLabels(),
            ]);
            const taskSummaries = tasks.map(task => ({
                id: task.id,
                content: task.content,
                description: task.description,
                priority: task.priority,
                due: task.due?.date,
                project: projects.find(p => p.id === task.project_id)?.name,
                labels: task.labels.map(labelId => {
                    const label = labels.find(l => l.id === labelId);
                    return label ? label.name : labelId;
                }),
                hasSubtasks: Boolean(task.children && task.children.length > 0),
                isCompleted: task.checked,
                isOverdue: this.isTaskOverdue(task),
            }));
            return this.sortTasks(taskSummaries);
        }
        catch (error) {
            console.error('Failed to get tasks with filters:', error);
            throw new Error(`Failed to retrieve tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getTasksForSubtaskGeneration() {
        try {
            const tasks = await this.getTasksWithFilters({
                status: 'active',
            });
            return tasks.filter(task => {
                if (task.hasSubtasks)
                    return false;
                if (task.content.length < 10)
                    return false;
                if (task.priority < 2)
                    return false;
                return true;
            });
        }
        catch (error) {
            console.error('Failed to get tasks for subtask generation:', error);
            throw new Error(`Failed to retrieve tasks for subtask generation: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getTaskDetails(taskId) {
        try {
            const [task, projects, labels] = await Promise.all([
                this.todoistClient.getTask(taskId),
                this.todoistClient.getProjects(),
                this.todoistClient.getLabels(),
            ]);
            const project = projects.find(p => p.id === task.project_id);
            const taskLabels = labels.filter(l => task.labels.includes(l.id));
            return {
                task,
                project,
                labels: taskLabels,
                subtasks: task.children,
            };
        }
        catch (error) {
            console.error('Failed to get task details:', error);
            throw new Error(`Failed to retrieve task details: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getTasksByProject() {
        try {
            const [projects, tasks] = await Promise.all([
                this.todoistClient.getProjects(),
                this.todoistClient.getTasks(),
            ]);
            const projectTasks = await Promise.all(projects.map(async (project) => {
                const projectTasksData = tasks.filter(task => task.project_id === project.id);
                const taskSummaries = await this.convertToTaskSummaries(projectTasksData);
                const completedCount = taskSummaries.filter(t => t.isCompleted).length;
                const overdueCount = taskSummaries.filter(t => t.isOverdue).length;
                return {
                    project,
                    tasks: taskSummaries,
                    completedCount,
                    overdueCount,
                };
            }));
            return projectTasks.sort((a, b) => a.project.order - b.project.order);
        }
        catch (error) {
            console.error('Failed to get tasks by project:', error);
            throw new Error(`Failed to retrieve tasks by project: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getTaskStatistics() {
        try {
            const [tasks, projects] = await Promise.all([
                this.todoistClient.getTasks(),
                this.todoistClient.getProjects(),
            ]);
            const today = new Date().toISOString().split('T')[0];
            const projectNames = projects.reduce((acc, project) => {
                acc[project.id] = project.name;
                return acc;
            }, {});
            const totalTasks = tasks.length;
            const completedTasks = tasks.filter(task => task.checked).length;
            const overdueTasks = tasks.filter(task => this.isTaskOverdue(task)).length;
            const todayTasks = tasks.filter(task => task.due?.date === today && !task.checked).length;
            const highPriorityTasks = tasks.filter(task => task.priority >= 3).length;
            const tasksByPriority = tasks.reduce((acc, task) => {
                acc[task.priority] = (acc[task.priority] || 0) + 1;
                return acc;
            }, {});
            const tasksByProject = tasks.reduce((acc, task) => {
                const projectName = projectNames[task.project_id] || task.project_id;
                acc[projectName] = (acc[projectName] || 0) + 1;
                return acc;
            }, {});
            return {
                totalTasks,
                completedTasks,
                overdueTasks,
                todayTasks,
                highPriorityTasks,
                tasksByPriority,
                tasksByProject,
            };
        }
        catch (error) {
            console.error('Failed to get task statistics:', error);
            throw new Error(`Failed to retrieve task statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async convertToTaskSummaries(tasks) {
        const [projects, labels] = await Promise.all([
            this.todoistClient.getProjects(),
            this.todoistClient.getLabels(),
        ]);
        return tasks.map(task => ({
            id: task.id,
            content: task.content,
            description: task.description,
            priority: task.priority,
            due: task.due?.date,
            project: projects.find(p => p.id === task.project_id)?.name,
            labels: task.labels.map(labelId => {
                const label = labels.find(l => l.id === labelId);
                return label ? label.name : labelId;
            }),
            hasSubtasks: Boolean(task.children && task.children.length > 0),
            isCompleted: task.checked,
            isOverdue: this.isTaskOverdue(task),
        }));
    }
    isTaskOverdue(task) {
        if (!task.due?.date || task.checked)
            return false;
        const dueDate = new Date(task.due.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return dueDate < today;
    }
    sortTasks(tasks) {
        return tasks.sort((a, b) => {
            if (a.priority !== b.priority) {
                return b.priority - a.priority;
            }
            if (a.due && b.due) {
                return new Date(a.due).getTime() - new Date(b.due).getTime();
            }
            if (a.isCompleted !== b.isCompleted) {
                return a.isCompleted ? 1 : -1;
            }
            return a.content.localeCompare(b.content);
        });
    }
    async getOverdueTasks() {
        return this.getTasksWithFilters({ status: 'active' }).then(tasks => tasks.filter(task => task.isOverdue));
    }
    async getTodayTasks() {
        const today = new Date().toISOString().split('T')[0];
        return this.getTasksWithFilters({
            status: 'active',
            dueDate: { from: today, to: today }
        });
    }
    async getHighPriorityTasks() {
        return this.getTasksWithFilters({
            status: 'active',
            priority: 4
        });
    }
    async getTasksWithoutDueDate() {
        return this.getTasksWithFilters({
            status: 'active'
        }).then(tasks => tasks.filter(task => !task.due));
    }
}
exports.TaskService = TaskService;
//# sourceMappingURL=task-service.js.map