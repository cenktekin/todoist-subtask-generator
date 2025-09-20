"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const index_1 = require("./index");
const config_1 = require("./config/config");
const winston_1 = __importDefault(require("winston"));
const logger = winston_1.default.createLogger({
    level: config_1.config.app.logLevel,
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
    transports: [
        new winston_1.default.transports.Console(),
        new winston_1.default.transports.File({ filename: 'logs/web-error.log', level: 'error' }),
        new winston_1.default.transports.File({ filename: 'logs/web-combined.log' }),
    ],
});
const webApp = (0, express_1.default)();
exports.webApp = webApp;
const PORT = config_1.config.app.port || 8080;
webApp.use((0, cors_1.default)());
webApp.use(express_1.default.json());
webApp.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
webApp.get('/api/health', async (req, res) => {
    try {
        const health = await index_1.app.healthCheck();
        res.json(health);
    }
    catch (error) {
        logger.error('Health check failed:', error);
        res.status(500).json({ error: 'Health check failed' });
    }
});
webApp.get('/api/tasks', async (req, res) => {
    try {
        const queryFilters = req.query;
        const filters = {};
        if (queryFilters.project_id) {
            filters.projectId = queryFilters.project_id;
        }
        if (queryFilters.label_id) {
            filters.label = queryFilters.label_id;
        }
        if (queryFilters.priority) {
            filters.priority = parseInt(queryFilters.priority);
        }
        if (queryFilters.due_date || queryFilters.due_date_lt || queryFilters.due_date_lte) {
            filters.dueDate = {};
            if (queryFilters.due_date) {
                filters.dueDate.from = queryFilters.due_date;
                filters.dueDate.to = queryFilters.due_date;
            }
            if (queryFilters.due_date_lt) {
                filters.dueDate.to = queryFilters.due_date_lt;
            }
            if (queryFilters.due_date_lte) {
                filters.dueDate.to = queryFilters.due_date_lte;
            }
        }
        logger.info('Task filters received:', queryFilters);
        logger.info('Converted filters:', filters);
        const tasks = await index_1.app.getTasks(filters);
        const tasksArray = Array.isArray(tasks) ? tasks : [];
        res.json(tasksArray);
    }
    catch (error) {
        logger.error('Failed to get tasks:', error);
        res.status(500).json({ error: 'Failed to get tasks' });
    }
});
webApp.get('/api/projects', async (req, res) => {
    try {
        const projects = await index_1.app.getProjects();
        res.json(projects);
    }
    catch (error) {
        logger.error('Failed to get projects:', error);
        res.status(500).json({ error: 'Failed to get projects' });
    }
});
webApp.get('/api/labels', async (req, res) => {
    try {
        const labels = await index_1.app.getLabels();
        res.json(labels);
    }
    catch (error) {
        logger.error('Failed to get labels:', error);
        res.status(500).json({ error: 'Failed to get labels' });
    }
});
webApp.get('/api/tasks/subtask-candidates', async (req, res) => {
    try {
        const candidates = await index_1.app.getSubtaskCandidates();
        res.json(candidates);
    }
    catch (error) {
        logger.error('Failed to get subtask candidates:', error);
        res.status(500).json({ error: 'Failed to get subtask candidates' });
    }
});
webApp.get('/api/tasks/:taskId/subtask-preview', async (req, res) => {
    try {
        const { taskId } = req.params;
        const options = req.query;
        const preview = await index_1.app.generateSubtaskPreview(taskId, options);
        res.json(preview);
    }
    catch (error) {
        logger.error('Failed to generate subtask preview:', error);
        res.status(500).json({ error: 'Failed to generate subtask preview' });
    }
});
webApp.post('/api/tasks/:taskId/subtasks', async (req, res) => {
    try {
        const { taskId } = req.params;
        const options = req.body;
        const result = await index_1.app.createSubtasksFromTask(taskId, options);
        res.json(result);
    }
    catch (error) {
        logger.error('Failed to create subtasks:', error);
        res.status(500).json({ error: 'Failed to create subtasks' });
    }
});
webApp.get('/api/tasks/:taskId/schedule', async (req, res) => {
    try {
        const { taskId } = req.params;
        const options = req.query;
        const schedule = await index_1.app.calculateTaskSchedule(taskId, options);
        res.json(schedule);
    }
    catch (error) {
        logger.error('Failed to calculate task schedule:', error);
        res.status(500).json({ error: 'Failed to calculate task schedule' });
    }
});
webApp.get('/api/tasks/:taskId/estimate', async (req, res) => {
    try {
        const { taskId } = req.params;
        const count = await index_1.app.estimateSubtaskCount(taskId);
        res.json({ count });
    }
    catch (error) {
        logger.error('Failed to estimate subtask count:', error);
        res.status(500).json({ error: 'Failed to estimate subtask count' });
    }
});
webApp.get('/', (req, res) => {
    res.sendFile('index.html', { root: path_1.default.join(__dirname, '../public') });
});
webApp.use((error, req, res, next) => {
    logger.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
});
webApp.listen(PORT, () => {
    logger.info(`🚀 Web server started on port ${PORT}`);
    logger.info(`📱 Access the application at: http://localhost:${PORT}`);
});
//# sourceMappingURL=web-server.js.map