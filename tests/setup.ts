// Test setup file
import { config, validateConfig } from '../src/config/config';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Mock environment variables for testing
process.env.TODOIST_API_TOKEN = 'test_token';
process.env.OPENROUTER_API_KEY = 'test_openrouter_key';

// Validate test configuration (disabled for testing)
try {
  validateConfig();
} catch (error) {
  console.warn('Test configuration validation failed (expected in test environment):', (error as Error).message);
}

// Global test utilities
import { TodoistTask, TodoistProject, TodoistLabel, TodoistUser } from '../src/api/types';

export const mockTodoistData = {
  tasks: [
    {
      id: '1',
      content: 'Complete project documentation',
      description: 'Write comprehensive documentation for the new feature',
      project_id: '1',
      priority: 3,
  due: { date: '2099-12-31' },
      labels: ['1', '2'],
      item_order: 1,
      collapsed: false,
      added_by_uid: '1',
      checked: false,
      in_history: false,
      is_deleted: false,
      url: 'https://todoist.app/task/1',
      comment_count: 0,
      created: '2024-01-01T00:00:00Z',
      creator_id: '1',
    },
    {
      id: '2',
      content: 'Review pull requests',
      description: 'Review and merge pending PRs',
      project_id: '2',
      priority: 2,
  due: { date: '2099-12-25' },
      labels: ['3'],
      item_order: 2,
      collapsed: false,
      added_by_uid: '1',
      checked: false,
      in_history: false,
      is_deleted: false,
      url: 'https://todoist.app/task/2',
      comment_count: 0,
      created: '2024-01-01T00:00:00Z',
      creator_id: '1',
    },
  ] as TodoistTask[],
  projects: [
    {
      id: '1',
      name: 'Work',
      color: 'blue',
      comment_count: 0,
      is_shared: false,
      is_favorite: false,
      inbox_project: false,
      team_inbox: false,
      order: 1,
      is_archived: false,
      is_deleted: false,
      url: 'https://todoist.app/project/1',
    },
    {
      id: '2',
      name: 'Personal',
      color: 'green',
      comment_count: 0,
      is_shared: false,
      is_favorite: false,
      inbox_project: false,
      team_inbox: false,
      order: 2,
      is_archived: false,
      is_deleted: false,
      url: 'https://todoist.app/project/2',
    },
  ] as TodoistProject[],
  labels: [
    {
      id: '1',
      name: 'Documentation',
      color: 'purple',
      item_order: 1,
      is_deleted: false,
    },
    {
      id: '2',
      name: 'Important',
      color: 'red',
      item_order: 2,
      is_deleted: false,
    },
    {
      id: '3',
      name: 'Review',
      color: 'orange',
      item_order: 3,
      is_deleted: false,
    },
  ] as TodoistLabel[],
  user: {
    id: '1',
    name: 'Test User',
    email: 'test@example.com',
    avatar: 'https://example.com/avatar.jpg',
    avatar_small: 'https://example.com/avatar_small.jpg',
    avatar_medium: 'https://example.com/avatar_medium.jpg',
    avatar_big: 'https://example.com/avatar_big.jpg',
    initials: 'TU',
    karma: 100,
    karma_trend: 'up',
    date_added: '2024-01-01T00:00:00Z',
    date_completed: '',
    date_current_timezone: 'Europe/Istanbul',
    completed_count: 50,
    badges: [],
    has_push_reminders: false,
    has_email_reminders: false,
    has_mobile_reminders: false,
    has_push_notifications: true,
    has_email_notifications: true,
    has_mobile_notifications: true,
    is_premium: false,
    business_account_id: '',
    minute_shortcuts: [],
    default_reminder: '10:00',
    default_timezone: 'Europe/Istanbul',
    language: 'en',
    full_sync: true,
    start_page: 'inbox',
    start_day: 1,
    next_week: 0,
    auto_reminder: true,
    token: 'test_token',
  } as TodoistUser,
};

export const mockAIResponse = {
  subtasks: [
    {
      content: 'Create project outline',
      due: '2024-12-30',
      priority: 3,
    },
    {
      content: 'Write API documentation',
      due: '2024-12-31',
      priority: 2,
    },
    {
      content: 'Create user guides',
      due: '2024-12-31',
      priority: 2,
    },
  ],
  estimatedDuration: '4 hours',
};

// Mock axios for testing
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { 
        use: jest.fn(),
        eject: jest.fn(),
      },
    },
  })),
}));

// Mock winston for testing
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

// Global test timeout
jest.setTimeout(30000);