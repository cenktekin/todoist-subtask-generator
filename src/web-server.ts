import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { app } from './index';
import { config } from './config/config';
import winston from 'winston';

// Logger setup
const logger = winston.createLogger({
  level: config.app.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/web-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/web-combined.log' }),
  ],
});

const webApp = express();
const PORT = config.app.port || 8080;

// Middleware
webApp.use(cors());
webApp.use(express.json());
webApp.use(express.static(path.join(__dirname, '../public')));

// API Routes
webApp.get('/api/health', async (req: Request, res: Response) => {
  try {
    const health = await app.healthCheck();
    res.json(health);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

webApp.get('/api/tasks', async (req: Request, res: Response) => {
  try {
    const queryFilters = req.query;
    
    // Convert frontend filter format to backend format
    const filters: any = {};
    
    if (queryFilters.project_id) {
      filters.projectId = queryFilters.project_id;
    }
    
    if (queryFilters.label_id) {
      filters.label = queryFilters.label_id;
    }
    
    if (queryFilters.priority) {
      filters.priority = parseInt(queryFilters.priority as string);
    }
    
    // Handle date filters
    if (queryFilters.due_date || queryFilters.due_date_lt || queryFilters.due_date_lte) {
      filters.dueDate = {};
      
      if (queryFilters.due_date) {
        // Exact date match - set both from and to
        filters.dueDate.from = queryFilters.due_date;
        filters.dueDate.to = queryFilters.due_date;
      }
      
      if (queryFilters.due_date_lt) {
        // Before this date
        filters.dueDate.to = queryFilters.due_date_lt;
      }
      
      if (queryFilters.due_date_lte) {
        // On or before this date
        filters.dueDate.to = queryFilters.due_date_lte;
      }
    }
    
    logger.info('Task filters received:', queryFilters);
    logger.info('Converted filters:', filters);
    
    const tasks = await app.getTasks(filters);
    
    // Ensure tasks is an array
    const tasksArray = Array.isArray(tasks) ? tasks : [];
    
    res.json(tasksArray);
  } catch (error) {
    logger.error('Failed to get tasks:', error);
    res.status(500).json({ error: 'Failed to get tasks' });
  }
});

webApp.get('/api/projects', async (req: Request, res: Response) => {
  try {
    const projects = await app.getProjects();
    res.json(projects);
  } catch (error) {
    logger.error('Failed to get projects:', error);
    res.status(500).json({ error: 'Failed to get projects' });
  }
});

webApp.get('/api/labels', async (req: Request, res: Response) => {
  try {
    const labels = await app.getLabels();
    res.json(labels);
  } catch (error) {
    logger.error('Failed to get labels:', error);
    res.status(500).json({ error: 'Failed to get labels' });
  }
});

webApp.get('/api/tasks/subtask-candidates', async (req: Request, res: Response) => {
  try {
    const candidates = await app.getSubtaskCandidates();
    res.json(candidates);
  } catch (error) {
    logger.error('Failed to get subtask candidates:', error);
    res.status(500).json({ error: 'Failed to get subtask candidates' });
  }
});

webApp.get('/api/tasks/:taskId/subtask-preview', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const options = req.query;
    const preview = await app.generateSubtaskPreview(taskId, options);
    res.json(preview);
  } catch (error) {
    logger.error('Failed to generate subtask preview:', error);
    res.status(500).json({ error: 'Failed to generate subtask preview' });
  }
});

webApp.post('/api/tasks/:taskId/subtasks', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const options = req.body;
    const result = await app.createSubtasksFromTask(taskId, options);
    res.json(result);
  } catch (error) {
    logger.error('Failed to create subtasks:', error);
    res.status(500).json({ error: 'Failed to create subtasks' });
  }
});

webApp.get('/api/tasks/:taskId/schedule', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const options = req.query;
    const schedule = await app.calculateTaskSchedule(taskId, options);
    res.json(schedule);
  } catch (error) {
    logger.error('Failed to calculate task schedule:', error);
    res.status(500).json({ error: 'Failed to calculate task schedule' });
  }
});

webApp.get('/api/tasks/:taskId/estimate', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const count = await app.estimateSubtaskCount(taskId);
    res.json({ count });
  } catch (error) {
    logger.error('Failed to estimate subtask count:', error);
    res.status(500).json({ error: 'Failed to estimate subtask count' });
  }
});

// Serve the main HTML page
webApp.get('/', (req: Request, res: Response) => {
  res.sendFile('index.html', { root: path.join(__dirname, '../public') });
});

// Error handling middleware
webApp.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
webApp.listen(PORT, () => {
  logger.info(`🚀 Web server started on port ${PORT}`);
  logger.info(`📱 Access the application at: http://localhost:${PORT}`);
});

export { webApp };
