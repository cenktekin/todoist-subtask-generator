"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../config/config");
class AIService {
    constructor() {
        this.availableModels = [];
        this.initializeClient();
    }
    initializeClient() {
        if (!config_1.config.openrouter.apiKey) {
            throw new Error('OpenRouter API key is required');
        }
        this.client = axios_1.default.create({
            baseURL: config_1.config.openrouter.baseUrl,
            headers: {
                'Authorization': `Bearer ${config_1.config.openrouter.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/todoist-subtask-generator',
                'X-Title': 'Todoist Subtask Generator',
            },
            timeout: 60000,
        });
    }
    async getAvailableModels() {
        try {
            const response = await this.client.get('/models');
            this.availableModels = response.data.data
                .filter((model) => model.id.includes('openai/') || model.id.includes('google/'))
                .map((model) => model.id);
            return this.availableModels;
        }
        catch (error) {
            console.error('Failed to fetch available models:', error);
            return [config_1.config.openrouter.defaultModel, config_1.config.openrouter.fallbackModel];
        }
    }
    async generateSubtasks(request) {
        const { taskContent, taskDescription, dueDate, maxSubtasks } = request;
        const systemPrompt = `Sen bir görev yönetimi uzmanısın. Ana görevi daha küçük, yönetilebilir alt görevlere ayırman gerekiyor.

Kurallar:
1. Görevi bağımsız olarak tamamlanabilecek mantıklı alt görevlere böl
2. Her alt görev spesifik ve eyleme dönük olmalı
3. Alt görevleri kısa ama açıklayıcı tut
4. Tam olarak ${maxSubtasks || config_1.config.subtaskGeneration.maxSubtasks} alt görev döndür
5. Görev basitse, daha az ama daha anlamlı alt görevler oluştur
6. Alt görevleri planlarken son tarihi dikkate al (sağlanmışsa)
7. Yanıtı sadece JSON formatında döndür
8. TÜM ALT GÖREVLERİ TÜRKÇE YAZ

Yanıt formatı:
{
  "subtasks": [
    {
      "content": "Alt görevin Türkçe açıklaması",
      "due": "YYYY-MM-DD (isteğe bağlı, ana görev son tarihine göre)",
      "priority": 1-4 (isteğe bağlı, 1=düşük, 4=yüksek)
    }
  ],
  "estimatedDuration": "Toplam tahmini süre (örn. '2 saat', '1 gün')"
}`;
        const userPrompt = `
Ana Görev: ${taskContent}
${taskDescription ? `Açıklama: ${taskDescription}` : ''}
${dueDate ? `Son Tarih: ${dueDate}` : ''}
${maxSubtasks ? `Maksimum Alt Görev: ${maxSubtasks}` : ''}

ÖNEMLI: Her alt görev için uygun tarihleri öner:
- Bugün: 2025-09-20
- Ana görevin son tarihi: ${dueDate || 'Belirtilmemiş'}
- Alt görevleri bu tarih aralığında mantıklı şekilde dağıt
- Önce yapılması gerekenler için daha erken tarihler ver
- Karmaşık alt görevler için daha fazla zaman ver

Lütfen bu görevi yukarıdaki kurallara uyarak alt görevlere böl. Alt görevlerin tamamı Türkçe olmalı.
`;
        try {
            let response = await this.callOpenAI(systemPrompt, userPrompt, config_1.config.openrouter.defaultModel);
            if (!response) {
                console.warn('Default model failed, trying fallback model...');
                response = await this.callOpenAI(systemPrompt, userPrompt, config_1.config.openrouter.fallbackModel);
            }
            if (!response) {
                throw new Error('Both default and fallback AI models failed');
            }
            return this.parseAIResponse(response.data.choices[0].message.content);
        }
        catch (error) {
            console.error('AI subtask generation failed:', error);
            throw new Error(`Failed to generate subtasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async callOpenAI(systemPrompt, userPrompt, model) {
        try {
            const response = await this.client.post('/chat/completions', {
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                max_tokens: config_1.config.openrouter.maxTokens,
                temperature: config_1.config.openrouter.temperature,
                response_format: { type: 'json_object' },
            });
            return response;
        }
        catch (error) {
            console.error(`AI model ${model} failed:`, error.message);
            if (error.response?.status === 429 || error.response?.status === 401) {
                throw error;
            }
            return null;
        }
    }
    parseAIResponse(content) {
        try {
            const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const parsed = JSON.parse(cleanContent);
            if (!parsed.subtasks || !Array.isArray(parsed.subtasks)) {
                throw new Error('Invalid AI response: missing or invalid subtasks array');
            }
            parsed.subtasks.forEach((subtask, index) => {
                if (!subtask.content || typeof subtask.content !== 'string') {
                    throw new Error(`Invalid subtask at index ${index}: missing or invalid content`);
                }
                if (subtask.due && !/^\d{4}-\d{2}-\d{2}$/.test(subtask.due)) {
                    throw new Error(`Invalid due date format at index ${index}: ${subtask.due}`);
                }
                if (subtask.priority && (subtask.priority < 1 || subtask.priority > 4)) {
                    throw new Error(`Invalid priority at index ${index}: ${subtask.priority}`);
                }
            });
            return {
                subtasks: parsed.subtasks,
                estimatedDuration: parsed.estimatedDuration || 'Unknown',
            };
        }
        catch (error) {
            console.error('Failed to parse AI response:', error);
            throw new Error(`Invalid AI response format: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async estimateTaskDuration(taskContent, taskDescription) {
        const prompt = `
Görev: ${taskContent}
${taskDescription ? `Açıklama: ${taskDescription}` : ''}

Bu görevi tamamlamak için gereken toplam süreyi tahmin et. Şunları dikkate al:
- Görevin karmaşıklığı
- İçerdiği adım sayısı
- Her adım için gereken süre
- Herhangi bir bağımlılık

Sadece tahmini süreyi okunabilir formatta döndür (örn. "2 saat", "1 gün", "30 dakika").
`;
        try {
            const response = await this.callOpenAI('Sen bir zaman tahmini uzmanısın. Görevler için doğru zaman tahminleri sağla. Yanıtlarını Türkçe ver.', prompt, config_1.config.openrouter.defaultModel);
            if (!response) {
                return 'Unknown';
            }
            const content = response.data.choices[0].message.content.trim();
            return content || 'Unknown';
        }
        catch (error) {
            console.error('Duration estimation failed:', error);
            return 'Unknown';
        }
    }
    async categorizeTask(taskContent, taskDescription) {
        const prompt = `
Görev: ${taskContent}
${taskDescription ? `Açıklama: ${taskDescription}` : ''}

Bu görevi ilgili kategorilere ayır. Bu görevi en iyi tanımlayan 1-3 kategori döndür.
Örnekler: "Geliştirme", "Tasarım", "Araştırma", "Planlama", "Dokümantasyon", "Test", "Toplantı", "İnceleme"

Sadece kategorileri JSON string dizisi olarak döndür.
`;
        try {
            const response = await this.callOpenAI('Sen bir görev kategorizasyon uzmanısın. Görevler için uygun kategoriler sağla. Kategorileri Türkçe ver.', prompt, config_1.config.openrouter.defaultModel);
            if (!response) {
                return [];
            }
            const content = response.data.choices[0].message.content.trim();
            const categories = JSON.parse(content);
            return Array.isArray(categories) ? categories.slice(0, 3) : [];
        }
        catch (error) {
            console.error('Task categorization failed:', error);
            return [];
        }
    }
    async testConnection() {
        try {
            const response = await this.callOpenAI('Sen yardımcı bir asistansın. Türkçe yanıt ver.', 'Lütfen "Bağlantı başarılı" şeklinde yanıt ver', config_1.config.openrouter.defaultModel);
            return response !== null;
        }
        catch (error) {
            console.error('AI connection test failed:', error);
            return false;
        }
    }
}
exports.AIService = AIService;
//# sourceMappingURL=ai-service.js.map