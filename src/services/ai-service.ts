import axios from 'axios';
import { config } from '../config/config';
import { SubtaskGenerationRequest, SubtaskGenerationResponse } from '../api/types';
import { safeParseJson } from '../utils/json-repair';

export class AIService {
  private client: any;
  private availableModels: string[] = [];

  constructor() {
    this.initializeClient();
  }

  private initializeClient(): void {
    if (!config.openrouter.apiKey) {
      throw new Error('OpenRouter API key is required');
    }

    this.client = axios.create({
      baseURL: config.openrouter.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.openrouter.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/todoist-subtask-generator',
        'X-Title': 'Todoist Subtask Generator',
      },
      timeout: 60000,
    });
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await this.client.get('/models');
      this.availableModels = response.data.data
        .filter((model: any) => model.id.includes('openai/') || model.id.includes('google/'))
        .map((model: any) => model.id);
      
      return this.availableModels;
    } catch (error) {
      console.error('Failed to fetch available models:', error);
      return [config.openrouter.defaultModel, config.openrouter.fallbackModel];
    }
  }

  async generateSubtasks(request: SubtaskGenerationRequest): Promise<SubtaskGenerationResponse> {
    const { taskContent, taskDescription, dueDate, maxSubtasks, additionalContext } = request;

    const systemPrompt = `Sen bir görev yönetimi uzmanısın. Ana görevi daha küçük, yönetilebilir alt görevlere ayırman gerekiyor.

TASK COMPLEXİTY ANALİZİ:
- Basit görevler (örn: "dosya gönder", "email yaz"): 3-6 alt görev
- Orta görevler (örn: "rapor hazırla", "toplantı organize et"): 6-12 alt görev  
- Karmaşık görevler (örn: "proje geliştir", "sistem oluştur"): 12-${maxSubtasks || config.subtaskGeneration.maxSubtasks} alt görev

KURALLAR:
1. Görevin gerçek karmaşıklığını değerlendir - küçük görevleri 20 alt göreve bölme!
2. Görevi bağımsız olarak tamamlanabilecek mantıklı alt görevlere böl
3. Her alt görev spesifik ve eyleme dönük olmalı
4. Alt görevleri kısa ama açıklayıcı tut
5. Gereksiz alt görev oluşturma, her biri değerli ve gerekli olmalı
6. Maksimum limit: ${maxSubtasks || config.subtaskGeneration.maxSubtasks} alt görev
7. Alt görevleri planlarken son tarihi dikkate al (sağlanmışsa)
8. Yanıtı sadece JSON formatında döndür
9. TÜM ALT GÖREVLERİ TÜRKÇE YAZ

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
${additionalContext ? `Ek Bağlam: ${additionalContext}` : ''}

ÖNEMLI: Her alt görev için uygun tarihleri öner:
- Bugün: ${new Date().toISOString().split('T')[0]}
- Ana görevin son tarihi: ${dueDate || 'Belirtilmemiş'}
- Alt görevleri BUGÜNDEN İTİBAREN bu tarih aralığında mantıklı şekilde dağıt
- Geçmiş tarihlere alt görev verme, sadece bugün ve gelecek tarihler kullan
- Önce yapılması gerekenler için daha erken tarihler ver (ama bugünden önce değil)
- Karmaşık alt görevler için daha fazla zaman ver

Lütfen bu görevi yukarıdaki kurallara uyarak alt görevlere böl. Alt görevlerin tamamı Türkçe olmalı.
`;

    // We separate model invocation & parsing to allow fallback on parse failures too
    const triedModels: string[] = [];
    const modelsToTry = [config.openrouter.defaultModel, config.openrouter.fallbackModel]
      .filter((m, i, arr) => arr.indexOf(m) === i); // de-duplicate if same

    let lastError: Error | null = null;

    const MAX_PARSE_ATTEMPTS_PER_MODEL = 2;

    for (const model of modelsToTry) {
      triedModels.push(model);
      let attempt = 0;
      let augmentedUserPrompt = userPrompt;
      while (attempt < MAX_PARSE_ATTEMPTS_PER_MODEL) {
        attempt++;
        try {
          const response = await this.callOpenAI(systemPrompt, augmentedUserPrompt, model);
          if (!response) {
            throw new Error(`Model ${model} returned empty response`);
          }
            const rawContent = response.data?.choices?.[0]?.message?.content;
          if (!rawContent) {
            throw new Error(`Model ${model} produced no content`);
          }
          try {
            return this.parseAIResponse(rawContent);
          } catch (parseErr: any) {
            if (attempt < MAX_PARSE_ATTEMPTS_PER_MODEL) {
              console.warn(`Parse attempt ${attempt} failed for model ${model}: ${parseErr.message}. Regenerating...`);
              augmentedUserPrompt = userPrompt + '\n\nÖNEMLI: Önceki yanıt JSON formatında tamamlanmadı. Lütfen SADECE geçerli JSON döndür.';
              continue; // retry parse with regeneration
            }
            throw parseErr;
          }
        } catch (err: any) {
          lastError = err instanceof Error ? err : new Error(String(err));
          console.warn(`Model ${model} attempt ${attempt} failed: ${lastError.message}`);
          if (attempt >= MAX_PARSE_ATTEMPTS_PER_MODEL) {
            break; // move to next model
          }
        }
      }
    }

    throw new Error(`Failed to generate subtasks after trying models (${triedModels.join(', ')}): ${lastError?.message}`);
  }

  private async callOpenAI(systemPrompt: string, userPrompt: string, model: string): Promise<any> {
    try {
      const response = await this.client.post('/chat/completions', {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: config.openrouter.maxTokens,
        temperature: config.openrouter.temperature,
        response_format: { type: 'json_object' },
      });

      return response;
    } catch (error: any) {
      console.error(`AI model ${model} failed:`, error.message);
      
      // If it's a rate limit or auth error, don't try fallback
      if (error.response?.status === 429 || error.response?.status === 401) {
        throw error;
      }
      
      return null;
    }
  }

  private parseAIResponse(content: string): SubtaskGenerationResponse {
    try {
      const parsed = safeParseJson(content);
      if (!parsed.subtasks || !Array.isArray(parsed.subtasks)) {
        throw new Error('Invalid AI response: missing or invalid subtasks array');
      }
      parsed.subtasks.forEach((subtask: any, index: number) => {
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
    } catch (error) {
      // For debugging, keep a minimal log (avoid leaking potentially large content)
      console.error('Failed to parse AI response (truncated preview):', content.slice(0, 200));
      throw new Error(`Invalid AI response format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async estimateTaskDuration(taskContent: string, taskDescription?: string): Promise<string> {
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
      const response = await this.callOpenAI(
        'Sen bir zaman tahmini uzmanısın. Görevler için doğru zaman tahminleri sağla. Yanıtlarını Türkçe ver.',
        prompt,
        config.openrouter.defaultModel
      );

      if (!response) {
        return 'Unknown';
      }

      const content = response.data.choices[0].message.content.trim();
      return content || 'Unknown';
    } catch (error) {
      console.error('Duration estimation failed:', error);
      return 'Unknown';
    }
  }

  async categorizeTask(taskContent: string, taskDescription?: string): Promise<string[]> {
    const prompt = `
Görev: ${taskContent}
${taskDescription ? `Açıklama: ${taskDescription}` : ''}

Bu görevi ilgili kategorilere ayır. Bu görevi en iyi tanımlayan 1-3 kategori döndür.
Örnekler: "Geliştirme", "Tasarım", "Araştırma", "Planlama", "Dokümantasyon", "Test", "Toplantı", "İnceleme"

Sadece kategorileri JSON string dizisi olarak döndür.
`;

    try {
      const response = await this.callOpenAI(
        'Sen bir görev kategorizasyon uzmanısın. Görevler için uygun kategoriler sağla. Kategorileri Türkçe ver.',
        prompt,
        config.openrouter.defaultModel
      );

      if (!response) {
        return [];
      }

      const content = response.data.choices[0].message.content.trim();
      const categories = JSON.parse(content);
      
      return Array.isArray(categories) ? categories.slice(0, 3) : [];
    } catch (error) {
      console.error('Task categorization failed:', error);
      return [];
    }
  }

  // Utility method to test AI connection
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.callOpenAI(
        'Sen yardımcı bir asistansın. Türkçe yanıt ver.',
        'Lütfen "Bağlantı başarılı" şeklinde yanıt ver',
        config.openrouter.defaultModel
      );

      return response !== null;
    } catch (error) {
      console.error('AI connection test failed:', error);
      return false;
    }
  }
}