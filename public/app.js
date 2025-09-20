let selectedTaskId = null;
let tasks = [];
let subtaskCandidates = [];
let projects = [];
let labels = [];
let currentFilters = {};

// Helper function to extract date string from various due date formats
function getTaskDateString(due) {
    if (!due) return null;
    
    let dateString = null;
    
    if (typeof due === 'string') {
        dateString = due;
    } else if (due.date) {
        dateString = due.date;
    } else if (due.datetime) {
        dateString = due.datetime;
    }
    
    if (!dateString) return null;
    
    // Extract just the date part (YYYY-MM-DD) from various formats
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return null;
        return date.toISOString().split('T')[0];
    } catch (e) {
        console.warn('Error parsing date:', dateString, e);
        return null;
    }
}

// Client-side filtering fallback
function filterTasksClientSide(allTasks, filters) {
    console.log('Applying client-side filters:', filters);
    let filteredTasks = [...allTasks];
    
    // Project filter
    if (filters.project_id) {
        filteredTasks = filteredTasks.filter(task => 
            task.project && task.project.id === filters.project_id
        );
        console.log(`After project filter: ${filteredTasks.length} tasks`);
    }
    
    // Priority filter
    if (filters.priority) {
        const priorityNum = parseInt(filters.priority);
        filteredTasks = filteredTasks.filter(task => task.priority === priorityNum);
        console.log(`After priority filter: ${filteredTasks.length} tasks`);
    }
    
    // Date filters
    if (filters.date) {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        console.log('Client-side date filter:', filters.date, 'Today:', todayStr);
        
        switch (filters.date) {
            case 'today':
                filteredTasks = filteredTasks.filter(task => {
                    if (!task.due) return false;
                    const taskDateStr = getTaskDateString(task.due);
                    if (!taskDateStr) return false;
                    return taskDateStr === todayStr;
                });
                break;
            case 'overdue':
                filteredTasks = filteredTasks.filter(task => {
                    if (!task.due) return false;
                    const taskDateStr = getTaskDateString(task.due);
                    if (!taskDateStr) return false;
                    return taskDateStr < todayStr;
                });
                break;
            case '7days':
                const next7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
                const next7DaysStr = next7Days.toISOString().split('T')[0];
                filteredTasks = filteredTasks.filter(task => {
                    if (!task.due) return false;
                    const taskDateStr = getTaskDateString(task.due);
                    if (!taskDateStr) return false;
                    return taskDateStr >= todayStr && taskDateStr <= next7DaysStr;
                });
                break;
            case '30days':
                const next30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
                const next30DaysStr = next30Days.toISOString().split('T')[0];
                filteredTasks = filteredTasks.filter(task => {
                    if (!task.due) return false;
                    const taskDateStr = getTaskDateString(task.due);
                    if (!taskDateStr) return false;
                    return taskDateStr >= todayStr && taskDateStr <= next30DaysStr;
                });
                break;
        }
        console.log(`After date filter (${filters.date}): ${filteredTasks.length} tasks`);
    }
    
    // Label filter (if labels are available in task object)
    if (filters.label_id && filters.label_id !== '') {
        filteredTasks = filteredTasks.filter(task => 
            task.labels && task.labels.some(label => 
                (typeof label === 'string' ? label : label.id) === filters.label_id
            )
        );
        console.log(`After label filter: ${filteredTasks.length} tasks`);
    }
    
    return filteredTasks;
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    loadHealth();
    loadProjects();
    loadLabels();
    loadTasks();
});

async function loadHealth() {
    try {
        const response = await fetch('/api/health');
        const health = await response.json();
        
        const healthStatus = document.getElementById('healthStatus');
        healthStatus.innerHTML = `
            <div class="health-item">
                <div class="health-indicator ${health.services.todoist}"></div>
                <span>Todoist: ${health.services.todoist}</span>
            </div>
            <div class="health-item">
                <div class="health-indicator ${health.services.ai}"></div>
                <span>AI Servisi: ${health.services.ai}</span>
            </div>
            <div class="health-item">
                <div class="health-indicator ${health.services.rateLimiter}"></div>
                <span>Rate Limiter: ${health.services.rateLimiter}</span>
            </div>
        `;
    } catch (error) {
        console.error('Health check failed:', error);
        document.getElementById('healthStatus').innerHTML = '<div class="error">Sistem durumu kontrol edilemedi</div>';
    }
}

async function loadProjects() {
    try {
        const response = await fetch('/api/projects');
        projects = await response.json();
        
        const projectFilter = document.getElementById('projectFilter');
        projectFilter.innerHTML = '<option value="">Tüm Projeler</option>';
        
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            projectFilter.appendChild(option);
        });
        
    } catch (error) {
        console.error('Failed to load projects:', error);
    }
}

async function loadLabels() {
    try {
        const response = await fetch('/api/labels');
        labels = await response.json();
        
        const labelFilter = document.getElementById('labelFilter');
        labelFilter.innerHTML = '<option value="">Tüm Etiketler</option>';
        
        labels.forEach(label => {
            const option = document.createElement('option');
            option.value = label.id;
            option.textContent = label.name;
            labelFilter.appendChild(option);
        });
        
    } catch (error) {
        console.error('Failed to load labels:', error);
    }
}

async function loadTasks(filters = {}) {
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '<div class="loading">Task\'lar yükleniyor...</div>';
    
    try {
        let apiTasks = [];
        
        // Try API first, fall back to client-side filtering if API fails
        try {
            // Build query parameters
            const queryParams = new URLSearchParams();
            
            if (filters.project_id) {
                queryParams.append('project_id', filters.project_id);
            }
            
            if (filters.label_id) {
                queryParams.append('label_id', filters.label_id);
            }
            
            if (filters.priority) {
                queryParams.append('priority', filters.priority);
            }
            
            // Date filters
            if (filters.date) {
                const today = new Date();
                const todayStr = today.toISOString().split('T')[0];
                
                console.log('Applying date filter:', filters.date, 'Today:', todayStr);
                
                switch (filters.date) {
                    case 'today':
                        queryParams.append('due_date', todayStr);
                        break;
                    case 'overdue':
                        queryParams.append('due_date_lt', todayStr);
                        break;
                    case '7days':
                        const next7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
                        queryParams.append('due_date_lte', next7Days.toISOString().split('T')[0]);
                        break;
                    case '30days':
                        const next30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
                        queryParams.append('due_date_lte', next30Days.toISOString().split('T')[0]);
                        break;
                }
            }
            
            const apiUrl = `/api/tasks${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
            console.log('Fetching from API:', apiUrl);
            
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`API responded with status ${response.status}`);
            }
            apiTasks = await response.json();
            console.log('API filtering successful, got', apiTasks.length, 'tasks');
            
            // Extra verification for date filters - if we get too many tasks for "today", something is wrong
            if (filters.date === 'today' && apiTasks.length > 50) {
                console.warn('Too many tasks for "today" filter, falling back to client-side filtering');
                throw new Error('API date filtering seems incorrect');
            }
            
        } catch (apiError) {
            console.warn('API request failed, using client-side filtering:', apiError);
            
            // Fallback: Get all tasks and filter client-side
            const response = await fetch('/api/tasks');
            if (response.ok) {
                const allTasks = await response.json();
                console.log('Total tasks from API:', allTasks.length);
                apiTasks = filterTasksClientSide(allTasks, filters);
                console.log('Tasks after client-side filtering:', apiTasks.length);
            } else {
                throw new Error('Both API filtering and fallback failed');
            }
        }
        
        tasks = apiTasks;
        
        // Ensure tasks is an array
        const tasksArray = Array.isArray(tasks) ? tasks : [];
        
        if (tasksArray.length === 0) {
            taskList.innerHTML = '<div class="loading">Filtre kriterlerine uygun task bulunamadı</div>';
            return;
        }
        
        taskList.innerHTML = tasksArray.map(task => {
            const dueInfo = getDueInfo(task.due);
            const priorityInfo = getPriorityInfo(task.priority);
            
            return `
                <div class="task-item" onclick="selectTask('${task.id}', this)">
                    <div class="task-main">
                        <div class="task-content">${task.content}</div>
                        <div class="task-meta">
                            ${getProjectInfo(task)}
                            ${getLabelInfo(task)}
                            ${dueInfo.text ? `📅 ${dueInfo.text}` : ''}
                        </div>
                    </div>
                    <div class="task-badges">
                        ${priorityInfo.html}
                        ${dueInfo.badge}
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Failed to load tasks:', error);
        taskList.innerHTML = '<div class="error">Task\'lar yüklenemedi</div>';
    }
}

function getDueInfo(due) {
    if (!due) return { text: '', badge: '' };
    
    // Handle different due date formats
    let dateString = null;
    
    if (typeof due === 'string') {
        // Due is directly a date string
        dateString = due;
    } else if (due.date) {
        // Due is an object with date property
        dateString = due.date;
    } else if (due.datetime) {
        // Due is an object with datetime property
        dateString = due.datetime;
    }
    
    if (!dateString) return { text: '', badge: '' };
    
    // Try to parse the date
    const dueDate = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(dueDate.getTime())) {
        console.warn('Invalid date received:', dateString);
        return { text: 'Geçersiz tarih', badge: '<span class="due-badge">Geçersiz tarih</span>' };
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time for accurate day comparison
    
    const dueDateOnly = new Date(dueDate);
    dueDateOnly.setHours(0, 0, 0, 0); // Reset time for accurate day comparison
    
    const diffTime = dueDateOnly.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let text = dueDate.toLocaleDateString('tr-TR');
    let badge = '';
    
    if (diffDays < 0) {
        badge = '<span class="due-badge due-overdue">Geçmiş</span>';
        text = `${Math.abs(diffDays)} gün gecikmeli`;
    } else if (diffDays === 0) {
        badge = '<span class="due-badge due-today">Bugün</span>';
        text = 'Bugün';
    } else if (diffDays <= 3) {
        badge = '<span class="due-badge due-soon">Yakında</span>';
        text = `${diffDays} gün sonra`;
    } else {
        badge = '<span class="due-badge">' + text + '</span>';
    }
    
    return { text, badge };
}

function getPriorityInfo(priority) {
    if (!priority || priority === 1) return { html: '' };
    
    const priorityNames = {
        4: 'P1',
        3: 'P2', 
        2: 'P3'
    };
    
    return {
        html: `<span class="priority-badge priority-${priority}">${priorityNames[priority]}</span>`
    };
}

function getProjectInfo(task) {
    if (!task) return '';
    
    let projectName = '';
    
    // Handle different project data formats
    if (task.project) {
        if (typeof task.project === 'string') {
            projectName = task.project;
        } else if (task.project.name) {
            projectName = task.project.name;
        }
    }
    
    // If no project name found, try to get from projects array using project_id
    if (!projectName && task.project_id && projects && projects.length > 0) {
        const project = projects.find(p => p.id === task.project_id);
        if (project) {
            projectName = project.name;
        }
    }
    
    return projectName ? `📁 ${projectName}` : '';
}

function getLabelInfo(task) {
    if (!task || !task.labels || task.labels.length === 0) return '';
    
    const labelNames = [];
    
    task.labels.forEach(label => {
        if (typeof label === 'string') {
            // If label is just a string (name or id), try to find the name
            const labelObj = labels.find(l => l.id === label || l.name === label);
            labelNames.push(labelObj ? labelObj.name : label);
        } else if (label.name) {
            // If label is an object with name property
            labelNames.push(label.name);
        }
    });
    
    return labelNames.length > 0 ? `🏷️ ${labelNames.join(', ')}` : '';
}

async function loadSubtaskCandidates() {
    try {
        const response = await fetch('/api/tasks/subtask-candidates');
        subtaskCandidates = await response.json();
        
        if (subtaskCandidates.length === 0) {
            showMessage('Subtask oluşturulmaya uygun task bulunamadı', 'error');
            return;
        }
        
        showMessage(`${subtaskCandidates.length} adet subtask oluşturulmaya uygun task bulundu`, 'success');
        
    } catch (error) {
        console.error('Failed to load subtask candidates:', error);
        showMessage('Subtask adayları yüklenemedi', 'error');
    }
}

function selectTask(taskId, element) {
    // Remove previous selection
    document.querySelectorAll('.task-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Add selection to clicked item
    element.classList.add('selected');
    selectedTaskId = taskId;
    
    // Enable buttons
    document.getElementById('previewBtn').disabled = false;
    document.getElementById('createBtn').disabled = false;
    document.getElementById('scheduleBtn').disabled = false;
    document.getElementById('candidatesBtn').disabled = false;
}

async function showSubtaskPreview() {
    if (!selectedTaskId) {
        showMessage('Lütfen bir task seçin', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/tasks/${selectedTaskId}/subtask-preview`);
        const preview = await response.json();
        
        const modal = document.getElementById('previewModal');
        const content = document.getElementById('previewContent');
        
        content.innerHTML = `
            <div class="subtask-list">
                ${preview.subtasks.map(subtask => `
                    <div class="subtask-item">
                        <div class="subtask-content">${subtask.content}</div>
                        <div class="subtask-date">Tahmini Süre: ${subtask.estimatedHours || 2} saat</div>
                    </div>
                `).join('')}
            </div>
        `;
        
        modal.style.display = 'block';
        
    } catch (error) {
        console.error('Failed to show subtask preview:', error);
        showMessage('Subtask önizleme oluşturulamadı', 'error');
    }
}

async function createSubtasks() {
    if (!selectedTaskId) {
        showMessage('Lütfen bir task seçin', 'error');
        return;
    }
    
    if (!confirm('Seçilen task için subtask oluşturulacak. Devam etmek istiyor musunuz?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/tasks/${selectedTaskId}/subtasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                maxSubtasks: 10,
                includeSchedule: true,
                distributeByTime: true,
                timeDistribution: 'equal', // 'equal', 'sequential', 'weighted'
                maxSubtasksPerDay: 3,
                includeWeekends: false,
                priorityStrategy: 'inherit'
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMessage(`${result.subtasksCreated} adet subtask oluşturuldu`, 'success');
            closeModal('previewModal');
            loadTasks(currentFilters); // Refresh task list with current filters
        } else {
            showMessage(result.error || 'Subtask oluşturulamadı', 'error');
        }
        
    } catch (error) {
        console.error('Failed to create subtasks:', error);
        showMessage('Subtask oluşturulamadı', 'error');
    }
}

async function showSchedule() {
    if (!selectedTaskId) {
        showMessage('Lütfen bir task seçin', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/tasks/${selectedTaskId}/schedule`);
        const schedule = await response.json();
        
        const modal = document.getElementById('scheduleModal');
        const content = document.getElementById('scheduleContent');
        
        content.innerHTML = `
            <div class="schedule-summary">
                <h3>📊 Özet</h3>
                <div class="summary-grid">
                    <div class="summary-item">
                        <strong>Toplam Subtask</strong>
                        ${schedule.summary.totalSubtasks}
                    </div>
                    <div class="summary-item">
                        <strong>Tahmini Süre</strong>
                        ${schedule.summary.totalEstimatedHours} saat
                    </div>
                    <div class="summary-item">
                        <strong>Çalışma Günü</strong>
                        ${schedule.summary.workDays} gün
                    </div>
                    <div class="summary-item">
                        <strong>Başlangıç</strong>
                        ${new Date(schedule.summary.startDate).toLocaleDateString('tr-TR')}
                    </div>
                    <div class="summary-item">
                        <strong>Bitiş</strong>
                        ${new Date(schedule.summary.endDate).toLocaleDateString('tr-TR')}
                    </div>
                </div>
            </div>
            
            <div class="schedule-timeline">
                <h3>📅 Zaman Çizelgesi</h3>
                <div class="timeline-container">
                    ${schedule.subtasks.map(subtask => `
                        <div class="timeline-item ${subtask.isWeekend ? 'weekend' : ''} priority-${subtask.priority}">
                            <div class="timeline-day">
                                <span class="day-number">Gün ${subtask.dayNumber}</span>
                                <span class="${subtask.isWeekend ? 'weekend-badge' : 'date-badge'}">
                                    ${new Date(subtask.dueDate).toLocaleDateString('tr-TR')}
                                </span>
                            </div>
                            <div class="timeline-content">
                                <div class="subtask-content">${subtask.content}</div>
                                <div class="task-meta">
                                    <span class="duration">⏱️ ${subtask.duration}</span>
                                    <span class="priority">🎯 P${subtask.priority}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        modal.style.display = 'block';
        
    } catch (error) {
        console.error('Failed to show schedule:', error);
        showMessage('Zaman çizelgesi oluşturulamadı', 'error');
    }
}

function applyFilters() {
    currentFilters = {
        project_id: document.getElementById('projectFilter').value,
        label_id: document.getElementById('labelFilter').value,
        priority: document.getElementById('priorityFilter').value,
        date: document.getElementById('dateFilter').value
    };
    
    // Remove empty filters
    Object.keys(currentFilters).forEach(key => {
        if (!currentFilters[key]) {
            delete currentFilters[key];
        }
    });
    
    console.log('Applying filters:', currentFilters);
    console.log('Current date:', new Date().toISOString().split('T')[0]);
    
    loadTasks(currentFilters);
}

function clearFilters() {
    document.getElementById('projectFilter').value = '';
    document.getElementById('labelFilter').value = '';
    document.getElementById('priorityFilter').value = '';
    document.getElementById('dateFilter').value = '';
    
    currentFilters = {};
    loadTasks();
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = type;
    messageDiv.textContent = message;
    
    // Insert message at the top of main-content
    const mainContent = document.querySelector('.main-content');
    const firstSection = mainContent.querySelector('.section');
    mainContent.insertBefore(messageDiv, firstSection);
    
    // Remove message after 5 seconds
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

// Close modals when clicking outside
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}