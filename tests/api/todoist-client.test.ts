import { TodoistClient } from '../../src/api/todoist-client';
import { mockTodoistData } from '../setup';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TodoistClient', () => {
  let todoistClient: TodoistClient;

  beforeEach(() => {
    todoistClient = new TodoistClient();
    jest.clearAllMocks();
  });

  describe('getUser', () => {
    it('should return user information', async () => {
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue({ data: mockTodoistData.user }),
      } as any);

      const user = await todoistClient.getUser();

      expect(user).toEqual(mockTodoistData.user);
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.todoist.com/rest/v1',
        headers: {
          'Authorization': 'Bearer test_token',
          'Content-Type': 'application/json',
        },
      });
    });

    it('should handle API errors', async () => {
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(new Error('API Error')),
      } as any);

      await expect(todoistClient.getUser()).rejects.toThrow('API Error');
    });
  });

  describe('getTasks', () => {
    it('should return all tasks', async () => {
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue({ data: mockTodoistData.tasks }),
      } as any);

      const tasks = await todoistClient.getTasks();

      expect(tasks).toEqual(mockTodoistData.tasks);
      expect(mockedAxios.create().get).toHaveBeenCalledWith('/tasks');
    });

    it('should handle filters', async () => {
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue({ data: mockTodoistData.tasks }),
      } as any);

      await todoistClient.getTasks({ project_id: '1' });

      expect(mockedAxios.create().get).toHaveBeenCalledWith('/tasks?project_id=1');
    });
  });

  describe('getTask', () => {
    it('should return a specific task', async () => {
      const taskId = '1';
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue({ 
          data: mockTodoistData.tasks.find(t => t.id === taskId) 
        }),
      } as any);

      const task = await todoistClient.getTask(taskId);

      expect(task).toEqual(mockTodoistData.tasks.find(t => t.id === taskId));
      expect(mockedAxios.create().get).toHaveBeenCalledWith(`/tasks/${taskId}`);
    });

    it('should handle non-existent task', async () => {
      const taskId = '999';
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(new Error('Task not found')),
      } as any);

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
      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue({ data: createdTask }),
      } as any);

      const result = await todoistClient.createTask(newTask);

      expect(result).toEqual(createdTask);
      expect(mockedAxios.create().post).toHaveBeenCalledWith('/tasks', newTask);
    });

    it('should handle task creation errors', async () => {
      const newTask = {
        content: 'New task',
        project_id: '1',
      };

      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockRejectedValue(new Error('Invalid task data')),
      } as any);

      await expect(todoistClient.createTask(newTask)).rejects.toThrow('Invalid task data');
    });
  });

  describe('updateTask', () => {
    it('should update an existing task', async () => {
      const taskId = '1';
      const updates = { content: 'Updated task content' };
      const updatedTask = { ...mockTodoistData.tasks[0], ...updates };

      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue({ data: updatedTask }),
      } as any);

      const result = await todoistClient.updateTask(taskId, updates);

      expect(result).toEqual(updatedTask);
      expect(mockedAxios.create().post).toHaveBeenCalledWith(`/tasks/${taskId}`, updates);
    });
  });

  describe('deleteTask', () => {
    it('should delete a task', async () => {
      const taskId = '1';
      mockedAxios.create.mockReturnValue({
        delete: jest.fn().mockResolvedValue({ data: {} }),
      } as any);

      await todoistClient.deleteTask(taskId);

      expect(mockedAxios.create().delete).toHaveBeenCalledWith(`/tasks/${taskId}`);
    });
  });

  describe('getProjects', () => {
    it('should return all projects', async () => {
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue({ data: mockTodoistData.projects }),
      } as any);

      const projects = await todoistClient.getProjects();

      expect(projects).toEqual(mockTodoistData.projects);
      expect(mockedAxios.create().get).toHaveBeenCalledWith('/projects');
    });
  });

  describe('getLabels', () => {
    it('should return all labels', async () => {
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue({ data: mockTodoistData.labels }),
      } as any);

      const labels = await todoistClient.getLabels();

      expect(labels).toEqual(mockTodoistData.labels);
      expect(mockedAxios.create().get).toHaveBeenCalledWith('/labels');
    });
  });
});