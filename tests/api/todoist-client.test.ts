import { TodoistClient } from '../../src/api/todoist-client';
import { mockTodoistData } from '../setup';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

function createAxiosInstance() {
  return {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  } as any;
}

describe('TodoistClient', () => {
  let todoistClient: TodoistClient;

  beforeEach(() => {
    jest.clearAllMocks();
    const instance = createAxiosInstance();
    mockedAxios.create.mockReturnValue(instance);
    todoistClient = new TodoistClient();
  });

  describe('testConnection', () => {
    it('should return true when projects endpoint accessible', async () => {
      const instance = mockedAxios.create.mock.results[0].value as any;
      instance.get.mockResolvedValue({ status: 200, data: [mockTodoistData.projects[0]], headers: {} });
      const ok = await todoistClient.testConnection();
      expect(ok).toBe(true);
      expect(instance.get).toHaveBeenCalled();
    });

    it('should return false on failure', async () => {
      const instance = mockedAxios.create.mock.results[0].value as any;
      instance.get.mockRejectedValue(new Error('API Error'));
      const ok = await todoistClient.testConnection();
      expect(ok).toBe(false);
    });
  });

  describe('getTasks', () => {
    it('should return all tasks', async () => {
      const instance = mockedAxios.create.mock.results[0].value as any;
      instance.get.mockResolvedValue({ data: mockTodoistData.tasks, headers: {} });
      const tasks = await todoistClient.getTasks();

      expect(tasks).toEqual(mockTodoistData.tasks);
      const call = instance.get.mock.calls[0];
      expect(call[0]).toBe('/tasks');
      expect(call[1].params.lang).toBe('tr');
    });

    it('should handle filters', async () => {
      const instance = mockedAxios.create.mock.results[0].value as any;
      instance.get.mockResolvedValue({ data: mockTodoistData.tasks, headers: {} });
      await todoistClient.getTasks({ project_id: '1' });
      const call = instance.get.mock.calls[0];
      expect(call[0]).toBe('/tasks');
      expect(call[1].params.project_id).toBe('1');
    });
  });

  describe('getTask', () => {
    it('should return a specific task', async () => {
      const taskId = '1';
      const instance = mockedAxios.create.mock.results[0].value as any;
      instance.get.mockResolvedValue({ data: mockTodoistData.tasks.find(t => t.id === taskId), headers: {} });
      const task = await todoistClient.getTask(taskId);

      expect(task).toEqual(mockTodoistData.tasks.find(t => t.id === taskId));
      expect(mockedAxios.create().get).toHaveBeenCalledWith(`/tasks/${taskId}`);
    });

    it('should handle non-existent task', async () => {
      const taskId = '999';
      const instance = mockedAxios.create.mock.results[0].value as any;
      instance.get.mockRejectedValue(new Error('Task not found'));
      await expect(todoistClient.getTask(taskId)).rejects.toThrow('Task not found');
    });
  });

  describe('createTask', () => {
    it('should create a new task', async () => {
      const newTask = {
        content: 'New task',
        project_id: '1',
        priority: 2,
      };

      const createdTask = { ...newTask, id: '3' };
      const instance = mockedAxios.create.mock.results[0].value as any;
      instance.post.mockResolvedValue({ data: createdTask, headers: {} });
      const result = await todoistClient.createTask(newTask);

      expect(result).toEqual(createdTask);
      expect(mockedAxios.create().post).toHaveBeenCalledWith('/tasks', newTask);
    });

    it('should handle task creation errors', async () => {
      const newTask = {
        content: 'New task',
        project_id: '1',
      };

      const instance = mockedAxios.create.mock.results[0].value as any;
      instance.post.mockRejectedValue(new Error('Invalid task data'));
      await expect(todoistClient.createTask(newTask)).rejects.toThrow('Invalid task data');
    });
  });

  describe('updateTask', () => {
    it('should update an existing task', async () => {
      const instance = mockedAxios.create.mock.results[0].value as any;
      const taskId = '1';
      const updates = { content: 'Updated task content' };
      const updatedTask = { ...mockTodoistData.tasks[0], ...updates };
      instance.post.mockResolvedValue({ data: updatedTask, headers: {} });
      const result = await todoistClient.updateTask(taskId, updates);
      expect(result).toEqual(updatedTask);
      expect(instance.post).toHaveBeenCalledWith(`/tasks/${taskId}`, updates);
    });
  });

  describe('getProjects', () => {
    it('should return all projects', async () => {
      const instance = mockedAxios.create.mock.results[0].value as any;
      instance.get.mockResolvedValue({ data: mockTodoistData.projects, headers: {} });
      const projects = await todoistClient.getProjects();

      expect(projects).toEqual(mockTodoistData.projects);
      expect(mockedAxios.create().get).toHaveBeenCalledWith('/projects');
    });
  });

  describe('getLabels', () => {
    it('should return all labels', async () => {
      const instance = mockedAxios.create.mock.results[0].value as any;
      instance.get.mockResolvedValue({ data: mockTodoistData.labels, headers: {} });
      const labels = await todoistClient.getLabels();

      expect(labels).toEqual(mockTodoistData.labels);
      expect(mockedAxios.create().get).toHaveBeenCalledWith('/labels');
    });
  });
});