import { TodoistClient } from '../api/todoist-client';
import { TodoistTask, TodoistProject, TodoistLabel, TaskFilterOptions } from '../api/types';
import { config } from '../config/config';

export interface TaskSummary {
  id: string;
  content: string;
  description?: string;
  priority: number;
  due?: string;
  project?: string;
  labels: string[];
  hasSubtasks: boolean;
  isCompleted: boolean;
  isOverdue: boolean;
}

export interface TaskFilter {
  projectId?: string;
  label?: string;
  priority?: number;
  dueDate?: {
    from?: string;
    to?: string;
  };
  status?: 'active' | 'completed' | 'all';
  searchQuery?: string;
}

export class TaskService {
  private todoistClient: TodoistClient;

  constructor(todoistClient: TodoistClient) {
    this.todoistClient = todoistClient;
  }

  // Get all tasks with enhanced filtering and sorting
  async getTasksWithFilters(filters: TaskFilter = {}): Promise<TaskSummary[]> {
    try {
      let tasks = await this.todoistClient.getTasks();
      let labelsData: TodoistLabel[] | null = null;

      // Apply filters
      if (filters.projectId) {
        tasks = tasks.filter(task => task.project_id === filters.projectId);
      }

      if (filters.label) {
        // Lazy load labels only if needed
        labelsData = labelsData || await this.todoistClient.getLabels();
        const target = filters.label.toLowerCase();
        // Try to map label name to id; else assume it's an id
        const labelObj = labelsData.find(l => l.name.toLowerCase() === target || l.id === filters.label);
        const labelId = labelObj ? labelObj.id : filters.label;
        tasks = tasks.filter(task => task.labels.includes(labelId));
      }

      if (filters.priority) {
        tasks = tasks.filter(task => task.priority === filters.priority);
      }

      if (filters.dueDate) {
        console.log('DEBUG: filtering tasks with:', JSON.stringify(filters));
        console.log('DEBUG: total tasks before filtering:', tasks.length);
        
        // Process date filter
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        console.log('DEBUG: today date for comparison:', now.toISOString());
        const today = now.toISOString().split('T')[0];
        
        if (filters.dueDate.from) {
          const beforeFilter = tasks.length;
          tasks = tasks.filter(task => {
            if (!task.due?.date) return false;
            const taskDate = task.due.date.split('T')[0]; // Handle both date and datetime formats
            return taskDate >= filters.dueDate!.from!;
          });
          console.log(`Filter by from date (${filters.dueDate.from}): ${beforeFilter} -> ${tasks.length} tasks`);
        }

        if (filters.dueDate.to) {
          const beforeFilter = tasks.length;
          tasks = tasks.filter(task => {
            if (!task.due?.date) return false;
            const taskDate = task.due.date.split('T')[0]; // Handle both date and datetime formats
            return taskDate <= filters.dueDate!.to!;
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
        tasks = tasks.filter(task => 
          task.content.toLowerCase().includes(query) ||
          (task.description && task.description.toLowerCase().includes(query))
        );
      }

      // Get projects and labels for better display
      const [projects, labels] = await Promise.all([
        this.todoistClient.getProjects(),
        labelsData ? Promise.resolve(labelsData) : this.todoistClient.getLabels(),
      ]);

      // Convert to TaskSummary with enhanced information
      const taskSummaries: TaskSummary[] = tasks.map(task => ({
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

      // Sort by priority and due date
      return this.sortTasks(taskSummaries);
    } catch (error) {
      console.error('Failed to get tasks with filters:', error);
      throw new Error(`Failed to retrieve tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get tasks suitable for subtask generation
  async getTasksForSubtaskGeneration(): Promise<TaskSummary[]> {
    try {
      const tasks = await this.getTasksWithFilters({
        status: 'active',
      });

      // Filter tasks that are good candidates for subtask generation
      return tasks.filter(task => {
        // Exclude tasks that already have subtasks
        if (task.hasSubtasks) return false;
        
        // Exclude very short tasks (likely too simple)
        if (task.content.length < 10) return false;
        
        // Exclude low priority tasks (optional)
        if (task.priority < 2) return false;
        
        // Include tasks with or without due dates
        return true;
      });
    } catch (error) {
      console.error('Failed to get tasks for subtask generation:', error);
      throw new Error(`Failed to retrieve tasks for subtask generation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get task details with full context
  async getTaskDetails(taskId: string): Promise<{
    task: TodoistTask;
    project?: TodoistProject;
    labels: TodoistLabel[];
    subtasks?: TodoistTask[];
  }> {
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
    } catch (error) {
      console.error('Failed to get task details:', error);
      throw new Error(`Failed to retrieve task details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get tasks grouped by project
  async getTasksByProject(): Promise<{
    project: TodoistProject;
    tasks: TaskSummary[];
    completedCount: number;
    overdueCount: number;
  }[]> {
    try {
      const [projects, tasks] = await Promise.all([
        this.todoistClient.getProjects(),
        this.todoistClient.getTasks(),
      ]);

      const projectTasks = await Promise.all(
        projects.map(async (project) => {
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
        })
      );

      return projectTasks.sort((a, b) => a.project.order - b.project.order);
    } catch (error) {
      console.error('Failed to get tasks by project:', error);
      throw new Error(`Failed to retrieve tasks by project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get tasks statistics
  async getTaskStatistics(): Promise<{
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    todayTasks: number;
    highPriorityTasks: number;
    tasksByPriority: Record<number, number>;
    tasksByProject: Record<string, number>;
  }> {
    try {
      const [tasks, projects] = await Promise.all([
        this.todoistClient.getTasks(),
        this.todoistClient.getProjects(),
      ]);

      const today = new Date().toISOString().split('T')[0];
      const projectNames = projects.reduce((acc, project) => {
        acc[project.id] = project.name;
        return acc;
      }, {} as Record<string, string>);

      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(task => task.checked).length;
      const overdueTasks = tasks.filter(task => this.isTaskOverdue(task)).length;
      const todayTasks = tasks.filter(task => task.due?.date === today && !task.checked).length;
      const highPriorityTasks = tasks.filter(task => task.priority >= 3).length;

      const tasksByPriority = tasks.reduce((acc, task) => {
        acc[task.priority] = (acc[task.priority] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      const tasksByProject = tasks.reduce((acc, task) => {
        const projectName = projectNames[task.project_id] || task.project_id;
        acc[projectName] = (acc[projectName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalTasks,
        completedTasks,
        overdueTasks,
        todayTasks,
        highPriorityTasks,
        tasksByPriority,
        tasksByProject,
      };
    } catch (error) {
      console.error('Failed to get task statistics:', error);
      throw new Error(`Failed to retrieve task statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Helper methods
  private async convertToTaskSummaries(tasks: TodoistTask[]): Promise<TaskSummary[]> {
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

  private isTaskOverdue(task: TodoistTask): boolean {
    if (!task.due?.date || task.checked) return false;
    
    const dueDate = new Date(task.due.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return dueDate < today;
  }

  private sortTasks(tasks: TaskSummary[]): TaskSummary[] {
    return tasks.sort((a, b) => {
      // First sort by priority (higher priority first)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      
      // Then sort by due date (earlier first)
      if (a.due && b.due) {
        return new Date(a.due).getTime() - new Date(b.due).getTime();
      }
      
      // Then sort by completion status (incomplete first)
      if (a.isCompleted !== b.isCompleted) {
        return a.isCompleted ? 1 : -1;
      }
      
      // Finally sort by content
      return a.content.localeCompare(b.content);
    });
  }

  // Quick filter methods
  async getOverdueTasks(): Promise<TaskSummary[]> {
    return this.getTasksWithFilters({ status: 'active' }).then(tasks => 
      tasks.filter(task => task.isOverdue)
    );
  }

  async getTodayTasks(): Promise<TaskSummary[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.getTasksWithFilters({ 
      status: 'active',
      dueDate: { from: today, to: today }
    });
  }

  async getHighPriorityTasks(): Promise<TaskSummary[]> {
    // Return tasks with priority >=3 (Todoist high priorities)
    const tasks = await this.getTasksWithFilters({ status: 'active' });
    return tasks.filter(t => t.priority >= 3);
  }

  async getTasksWithoutDueDate(): Promise<TaskSummary[]> {
    return this.getTasksWithFilters({ 
      status: 'active'
    }).then(tasks => tasks.filter(task => !task.due));
  }
}