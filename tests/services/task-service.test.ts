import { TaskService } from '../../src/services/task-service';
import { TodoistClient } from '../../src/api/todoist-client';
import { mockTodoistData } from '../setup';

// Mock TodoistClient with only methods we use
jest.mock('../../src/api/todoist-client', () => {
  return {
    TodoistClient: jest.fn().mockImplementation(() => ({
      getTasks: jest.fn(),
      getTask: jest.fn(),
      getProjects: jest.fn(),
      getLabels: jest.fn(),
    }))
  };
});
const { TodoistClient: MockedTodoistClient } = jest.requireMock('../../src/api/todoist-client');

describe('TaskService', () => {
  let taskService: TaskService;
  let mockTodoistClient: any;

  beforeEach(() => {
    mockTodoistClient = new MockedTodoistClient();
    taskService = new TaskService(mockTodoistClient);
    jest.clearAllMocks();
    // Default mocks
    mockTodoistClient.getProjects.mockResolvedValue(require('../setup').mockTodoistData.projects);
    mockTodoistClient.getLabels.mockResolvedValue(require('../setup').mockTodoistData.labels);
  });

  describe('getTasksWithFilters', () => {
    it('should return all tasks with no filters', async () => {
      mockTodoistClient.getTasks.mockResolvedValue(mockTodoistData.tasks);
      mockTodoistClient.getProjects.mockResolvedValue(mockTodoistData.projects);
      mockTodoistClient.getLabels.mockResolvedValue(mockTodoistData.labels);

      const tasks = await taskService.getTasksWithFilters();

      expect(tasks).toHaveLength(2);
      expect(tasks[0]).toHaveProperty('id');
      expect(tasks[0]).toHaveProperty('content');
      expect(tasks[0]).toHaveProperty('priority');
      expect(tasks[0]).toHaveProperty('project');
      expect(tasks[0]).toHaveProperty('labels');
    });

    it('should filter tasks by project', async () => {
      mockTodoistClient.getTasks.mockResolvedValue(mockTodoistData.tasks);
      mockTodoistClient.getProjects.mockResolvedValue(mockTodoistData.projects);
      mockTodoistClient.getLabels.mockResolvedValue(mockTodoistData.labels);

      const tasks = await taskService.getTasksWithFilters({ projectId: '1' });

      expect(tasks).toHaveLength(1);
      expect(tasks[0].project).toBe('Work');
    });

    it('should filter tasks by label', async () => {
      mockTodoistClient.getTasks.mockResolvedValue(mockTodoistData.tasks);
      mockTodoistClient.getProjects.mockResolvedValue(mockTodoistData.projects);
      mockTodoistClient.getLabels.mockResolvedValue(mockTodoistData.labels);

      const tasks = await taskService.getTasksWithFilters({ label: 'Documentation' });

      expect(tasks).toHaveLength(1);
      expect(tasks[0].labels).toContain('Documentation');
    });

    it('should filter tasks by priority', async () => {
      mockTodoistClient.getTasks.mockResolvedValue(mockTodoistData.tasks);
      mockTodoistClient.getProjects.mockResolvedValue(mockTodoistData.projects);
      mockTodoistClient.getLabels.mockResolvedValue(mockTodoistData.labels);

      const tasks = await taskService.getTasksWithFilters({ priority: 3 });

      expect(tasks).toHaveLength(1);
      expect(tasks[0].priority).toBe(3);
    });

    it('should filter tasks by status', async () => {
      mockTodoistClient.getTasks.mockResolvedValue(mockTodoistData.tasks);
      mockTodoistClient.getProjects.mockResolvedValue(mockTodoistData.projects);
      mockTodoistClient.getLabels.mockResolvedValue(mockTodoistData.labels);

      const tasks = await taskService.getTasksWithFilters({ status: 'completed' });

      expect(tasks).toHaveLength(0); // No completed tasks in mock data
    });

    it('should filter tasks by search query', async () => {
      mockTodoistClient.getTasks.mockResolvedValue(mockTodoistData.tasks);
      mockTodoistClient.getProjects.mockResolvedValue(mockTodoistData.projects);
      mockTodoistClient.getLabels.mockResolvedValue(mockTodoistData.labels);

      const tasks = await taskService.getTasksWithFilters({ searchQuery: 'review' });

      expect(tasks).toHaveLength(1);
      expect(tasks[0].content.toLowerCase()).toContain('review');
    });

    it('should sort tasks by priority and due date', async () => {
      const tasksWithDifferentPriorities = [
        { ...mockTodoistData.tasks[0], priority: 1, due: { date: '2024-12-31' } },
        { ...mockTodoistData.tasks[1], priority: 4, due: { date: '2024-12-25' } },
      ];

      mockTodoistClient.getTasks.mockResolvedValue(tasksWithDifferentPriorities);
      mockTodoistClient.getProjects.mockResolvedValue(mockTodoistData.projects);
      mockTodoistClient.getLabels.mockResolvedValue(mockTodoistData.labels);

      const tasks = await taskService.getTasksWithFilters();

      expect(tasks[0].priority).toBe(4); // Higher priority first
      expect(tasks[1].priority).toBe(1);
    });
  });

  describe('getTasksForSubtaskGeneration', () => {
    it('should return tasks suitable for subtask generation', async () => {
      const tasksWithSubtasks = [
        { ...mockTodoistData.tasks[0], children: [{ ...mockTodoistData.tasks[0], id: 'sub1' }] },
        mockTodoistData.tasks[1],
      ];

      mockTodoistClient.getTasks.mockResolvedValue(tasksWithSubtasks);
      mockTodoistClient.getProjects.mockResolvedValue(mockTodoistData.projects);
      mockTodoistClient.getLabels.mockResolvedValue(mockTodoistData.labels);

      const tasks = await taskService.getTasksForSubtaskGeneration();

      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('2'); // Only the task without subtasks
    });

    it('should exclude very short tasks', async () => {
      const shortTask = { ...mockTodoistData.tasks[0], content: 'Hi' };
      mockTodoistClient.getTasks.mockResolvedValue([shortTask]);
      mockTodoistClient.getProjects.mockResolvedValue(mockTodoistData.projects);
      mockTodoistClient.getLabels.mockResolvedValue(mockTodoistData.labels);

      const tasks = await taskService.getTasksForSubtaskGeneration();

      expect(tasks).toHaveLength(0);
    });
  });

  describe('getTaskDetails', () => {
    it('should return task details with project and labels', async () => {
      mockTodoistClient.getTask.mockResolvedValue(mockTodoistData.tasks[0]);
      mockTodoistClient.getProjects.mockResolvedValue(mockTodoistData.projects);
      mockTodoistClient.getLabels.mockResolvedValue(mockTodoistData.labels);

      const details = await taskService.getTaskDetails('1');

      expect(details.task).toEqual(mockTodoistData.tasks[0]);
      expect(details.project).toEqual(mockTodoistData.projects[0]);
      expect(details.labels).toHaveLength(2);
    });
  });

  describe('getTasksByProject', () => {
    it('should return tasks grouped by project', async () => {
      mockTodoistClient.getProjects.mockResolvedValue(mockTodoistData.projects);
      mockTodoistClient.getTasks.mockResolvedValue(mockTodoistData.tasks);

      const projectTasks = await taskService.getTasksByProject();

      expect(projectTasks).toHaveLength(2);
      expect(projectTasks[0].project.name).toBe('Work');
      expect(projectTasks[0].tasks).toHaveLength(1);
      expect(projectTasks[1].project.name).toBe('Personal');
      expect(projectTasks[1].tasks).toHaveLength(1);
    });
  });

  describe('getTaskStatistics', () => {
    it('should return task statistics', async () => {
      mockTodoistClient.getTasks.mockResolvedValue(mockTodoistData.tasks);
      mockTodoistClient.getProjects.mockResolvedValue(mockTodoistData.projects);

      const stats = await taskService.getTaskStatistics();

      expect(stats).toHaveProperty('totalTasks', 2);
      expect(stats).toHaveProperty('completedTasks', 0);
      expect(stats).toHaveProperty('overdueTasks', 0);
      expect(stats).toHaveProperty('todayTasks', 0);
      expect(stats).toHaveProperty('highPriorityTasks', 1);
      expect(stats).toHaveProperty('tasksByPriority');
      expect(stats).toHaveProperty('tasksByProject');
    });
  });

  describe('getOverdueTasks', () => {
    it('should return overdue tasks', async () => {
      const pastDueDate = new Date();
      pastDueDate.setDate(pastDueDate.getDate() - 1);
      const pastDateString = pastDueDate.toISOString().split('T')[0];

      const overdueTask = { ...mockTodoistData.tasks[0], due: { date: pastDateString } };
      mockTodoistClient.getTasks.mockResolvedValue([overdueTask]);
      mockTodoistClient.getProjects.mockResolvedValue(mockTodoistData.projects);
      mockTodoistClient.getLabels.mockResolvedValue(mockTodoistData.labels);

      const tasks = await taskService.getOverdueTasks();

      expect(tasks).toHaveLength(1);
      expect(tasks[0].isOverdue).toBe(true);
    });
  });

  describe('getTodayTasks', () => {
    it('should return tasks for today', async () => {
      const today = new Date().toISOString().split('T')[0];
      const todayTask = { ...mockTodoistData.tasks[0], due: { date: today } };
      mockTodoistClient.getTasks.mockResolvedValue([todayTask]);
      mockTodoistClient.getProjects.mockResolvedValue(mockTodoistData.projects);
      mockTodoistClient.getLabels.mockResolvedValue(mockTodoistData.labels);

      const tasks = await taskService.getTodayTasks();

      expect(tasks).toHaveLength(1);
      expect(tasks[0].due).toBe(today);
    });
  });

  describe('getHighPriorityTasks', () => {
    it('should return high priority tasks', async () => {
      mockTodoistClient.getTasks.mockResolvedValue(mockTodoistData.tasks);
      mockTodoistClient.getProjects.mockResolvedValue(mockTodoistData.projects);
      mockTodoistClient.getLabels.mockResolvedValue(mockTodoistData.labels);

      const tasks = await taskService.getHighPriorityTasks();

      expect(tasks).toHaveLength(1);
      expect(tasks[0].priority).toBe(3);
    });
  });

  describe('getTasksWithoutDueDate', () => {
    it('should return tasks without due date', async () => {
      const taskWithoutDueDate = { ...mockTodoistData.tasks[0], due: undefined };
      mockTodoistClient.getTasks.mockResolvedValue([taskWithoutDueDate]);
      mockTodoistClient.getProjects.mockResolvedValue(mockTodoistData.projects);
      mockTodoistClient.getLabels.mockResolvedValue(mockTodoistData.labels);

      const tasks = await taskService.getTasksWithoutDueDate();

      expect(tasks).toHaveLength(1);
      expect(tasks[0].due).toBeUndefined();
    });
  });
});