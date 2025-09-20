// Todoist API Response Types
export interface TodoistTask {
  id: string;
  project_id: string;
  content: string;
  description?: string;
  priority: number; // 1-4 (4 en yüksek)
  due?: {
    date?: string;
    datetime?: string;
    string?: string;
    timezone?: string;
  };
  labels: string[];
  item_order: number;
  collapsed: boolean;
  children?: TodoistTask[]; // Subtasks
  added_by_uid: string;
  assigned_by_uid?: string;
  responsible_uid?: string;
  checked: boolean;
  in_history: boolean;
  is_deleted: boolean;
  url: string;
  comment_count: number;
  created: string;
  creator_id: string;
}

export interface TodoistProject {
  id: string;
  name: string;
  color: string;
  comment_count: number;
  is_shared: boolean;
  is_favorite: boolean;
  inbox_project: boolean;
  team_inbox: boolean;
  order: number;
  is_archived: boolean;
  is_deleted: boolean;
  url: string;
}

export interface TodoistLabel {
  id: string;
  name: string;
  color: string;
  item_order: number;
  is_deleted: boolean;
}

export interface TodoistUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  avatar_small: string;
  avatar_medium: string;
  avatar_big: string;
  initials: string;
  karma: number;
  karma_trend: string;
  date_added: string;
  date_completed: string;
  date_current_timezone: string;
  completed_count: number;
  badges: string[];
  has_push_reminders: boolean;
  has_email_reminders: boolean;
  has_mobile_reminders: boolean;
  has_push_notifications: boolean;
  has_email_notifications: boolean;
  has_mobile_notifications: boolean;
  is_premium: boolean;
  business_account_id: string;
  minute_shortcuts: string[];
  default_reminder: string;
  default_timezone: string;
  language: string;
  full_sync: boolean;
  start_page: string;
  start_day: number;
  next_week: number;
  auto_reminder: boolean;
  token: string;
}

// API Request Types
export interface CreateTaskRequest {
  content: string;
  project_id?: string;
  due?: {
    date?: string;
    datetime?: string;
    string?: string;
    timezone?: string;
  };
  priority?: number;
  labels?: string[];
  parent_id?: string; // For subtasks
  description?: string;
}

export interface UpdateTaskRequest {
  content?: string;
  due?: {
    date?: string;
    datetime?: string;
    string?: string;
    timezone?: string;
  };
  priority?: number;
  labels?: string[];
  description?: string;
}

export interface TaskFilterOptions {
  project_id?: string;
  label?: string;
  filter?: string;
  lang?: string;
}

export interface SubtaskGenerationRequest {
  taskContent: string;
  taskDescription?: string;
  dueDate?: string;
  maxSubtasks?: number;
}

export interface SubtaskGenerationResponse {
  subtasks: Array<{
    content: string;
    due?: string;
    priority?: number;
  }>;
  estimatedDuration: string;
}

// Error Types
export interface TodoistError {
  error: string;
  error_code?: string;
  error_extra?: Record<string, unknown>;
}

export interface APIError {
  message: string;
  status: number;
  code?: string;
  details?: Record<string, unknown>;
}

// Response Types
export interface TasksResponse {
  tasks: TodoistTask[];
  projects: TodoistProject[];
  labels: TodoistLabel[];
}

export interface PaginationParams {
  offset?: number;
  limit?: number;
}

export interface SyncResponse {
  sync_token: string;
  items: {
    projects: TodoistProject[];
    tasks: TodoistTask[];
    labels: TodoistLabel[];
    notes?: any[];
    filters?: any[];
    reminders?: any[];
    locations?: any[];
    day_orders?: any[];
    labels_orders?: any[];
    project_notes?: any[];
    project_reminders?: any[];
    live_notifications?: any[];
    project_completed?: any[];
    settings?: any[];
    user?: TodoistUser;
  };
}