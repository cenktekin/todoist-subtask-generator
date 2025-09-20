# Todoist Subtask Generator

Todoist üzerindeki task'ları seçerek **AI (Türkçe)** yardımıyla mantıklı alt görevlere (subtask) bölen, zaman çizelgesi (schedule) hesaplayan ve son tarihe göre akıllı tarih dağıtımı yapan bir uygulama. Modern web arayüzü ile gelişmiş filtreleme (proje, etiket, öncelik, tarih, arama) sunar.

## 🚀 Özellikler

- **Gelişmiş Web Arayüzü**: Proje, etiket, öncelik, tarih (bugün / 7 gün / 30 gün / geciken / aralık) ve arama filtreleri
- **Türkçe AI Subtask Üretimi**: OpenRouter üzerinden Türkçe içerik ve açıklamalarla alt görev üretimi
- **Akıllı Tarih Dağıtımı**: Ana görevin son tarihine göre alt görevlerin zaman eksenine yayılması (eşit / weighted / sequential)
- **Zaman Çizelgesi (Schedule)**: Mevcut subtask'ları kullanarak veya AI ile tahmini çıkararak çalışma günlerine dağıtım
- **Öncelik Stratejileri**: `inherit`, `distribute`, `constant` seçenekleri
- **Hafta Sonu Kontrolü**: Hafta sonlarını dahil et / etme seçeneği
- **Mevcut Subtask Kullanımı**: Schedule hesaplanırken zaten oluşturulmuş subtasks varsa tekrar AI çağrılmaz
- **Hata Yönetimi & Retry**: Sağlam hata yakalama, düşen entegrasyonlara rağmen çalışma
- **Rate Limit Koruması**: Todoist API limitlerini aşmayan akıllı istemci
- **Türkçe Terminoloji**: UI ve AI çıktıları Türkçeleştirilmiş
- **Güvenlik Odaklı Repo Temizliği**: Arşivleme stratejisi ve hassas veri taraması yönergeleri

## 📋 Gereksinimler

- Node.js 18.0.0 veya üstü
- Todoist API Token (https://todoist.com/app/integrations/api-token)
- OpenRouter API Key (https://openrouter.ai/keys)

## 🛠️ Kurulum

1. **Depoyu klonlayın**:
```bash
git clone <repository-url>
cd todoist-subtask
```

2. **Bağımlılıkları yükleyin**:
```bash
npm install
```

3. **Ortam değişkenlerini yapılandırın**:
```bash
cp .env.example .env
```

4. **.env dosyasını düzenleyin**:
  - Kendi Todoist API token'ınızı kopyalayın: https://todoist.com/app/integrations/api-token
  - Kendi OpenRouter API anahtarınızı oluşturun: https://openrouter.ai/keys
  - `.env` dosyasını düzenleyerek kendi token'larınızı ekleyin
  - **ÖNEMLİ**: Gerçek token'larınızı asla Git'e commitlemeyin!

5. **Uygulamayı başlatın**:
```bash
npm run dev
```

## 📖 Kullanım

### 1. Web Arayüzü (Önerilen Yol)

Uygulamanın ana kullanım şekli modern web arayüzüdür.

1. Ortam değişkenlerini `.env` içinde tanımlayın (`TODOIST_API_TOKEN`, `OPENROUTER_API_KEY`)
2. Geliştirme sunucusunu başlatın:
```bash
npm run dev
```
3. Tarayıcıda açın: `http://localhost:8080` (veya `.env` içindeki `PORT` değeri)
4. Sol/üst filtre barından proje, etiket, öncelik, tarih veya arama kriteri uygulayın
5. Subtask üretmek istediğiniz task kartına tıklayın
6. Açılan panelden:
   - Subtask önizleme alın (AI çağrısı yapılır)
   - Tarih dağıtımı stratejisi seçin (`equal`, `weighted`, `sequential`)
   - Hafta sonlarını dahil edip etmeyeceğinizi seçin
   - Öncelik stratejisi seçin (`inherit`, `distribute`, `constant`)
   - İsterseniz `constant` için sabit öncelik girin
7. Onaylayıp subtask'ları Todoist'e gönderin
8. İsterseniz aynı panelden `Schedule` (Zaman Çizelgesi) modunu açarak gün bazlı dağılımı inceleyin

Web UI'da ek özellikler:
* Aşırı geniş task listelerinde client-side ek filtreleme
* Mevcut subtask'lar varsa AI'ı tekrar çağırmadan schedule hesaplama
* Tarih rozetleri ve öncelik renkleriyle hızlı görsel durum

### 2. Programatik Kullanım (Opsiyonel)

Arayüz dışında Node.js üzerinden de kullanmak isterseniz aşağıdaki örnekleri uygulayabilirsiniz.

```typescript
import { app } from './src/index';

await app.initialize();

const tasks = await app.getTasks();
const candidates = await app.getSubtaskCandidates();
const preview = await app.generateSubtaskPreview('task_id');
const result = await app.createSubtasksFromTask('task_id');
```

#### Filtreleme Örnekleri

```typescript
const projectTasks = await app.getTasks({ projectId: '123' });
const labeledTasks = await app.getTasks({ label: 'important' });
const highPriorityTasks = await app.getTasks({ priority: 4 });
const datedTasks = await app.getTasks({ dueDate: { from: '2024-12-01', to: '2024-12-31' } });
const searchResults = await app.getTasks({ searchQuery: 'dokümantasyon' });
```

#### Subtask Oluşturma Seçenekleri

```typescript
const options = {
  distributeByTime: true,
  timeDistribution: 'equal', // 'equal' | 'weighted' | 'sequential'
  maxSubtasksPerDay: 3,
  includeWeekends: false,
  priorityStrategy: 'inherit', // 'inherit' | 'distribute' | 'constant'
  constantPriority: 2,
};
await app.createSubtasksFromTask('task_id', options);
```

#### Toplu İşlemler

```typescript
const taskIds = ['task1', 'task2', 'task3'];
const results = await app.createSubtasksForMultipleTasks(taskIds, options);
```

#### Zaman Çizelgesi (Schedule) Hesaplama

```typescript
const schedule = await app.calculateTaskSchedule('task_id', {
  workDayStart: '09:00',
  workDayEnd: '17:00',
  dailyWorkHours: 8,
  includeWeekends: false,
});
```

## 🌐 Web Arayüzü Özeti

Tarayıcıdan erişilen arayüzde şu bileşenler bulunur:

- Üst filtre barı (proje, etiket, öncelik, tarih seçici, arama kutusu)
- Görev listesi (renkli öncelik göstergeleri ve planlanmış tarih rozetleri)
- Subtask önizleme modali (AI tarafından üretilen alt görevler, tarih ve öncelik bilgileri)
- Zaman çizelgesi modali (gün bazında dağıtılmış alt görev görünümü)

Tarih filtresi seçenekleri:
- `today` – Sadece bugün
- `7days` – Bugün + 7 gün
- `30days` – Bugün + 30 gün
- `overdue` – Gecikenler
- `range` – Belirli aralık (from/to)
- `all` – Tarih kısıtı yok

Arayüz ayrıca aşırı geniş sonuçlarda client-side ek süzgeç uygulayarak gereksiz kaydı eler.

## 🔧 API Referansı

### Todoist API Endpoint'leri

- `GET /rest/v1/tasks` - Task listesini getirir
- `POST /rest/v1/tasks` - Yeni task oluşturur
- `GET /rest/v1/tasks/{id}` - Belirli task'ı getirir
- `POST /rest/v1/tasks/{id}` - Task'ı günceller
- `DELETE /rest/v1/tasks/{id}` - Task'ı siler
- `GET /rest/v1/projects` - Proje listesini getirir
- `GET /rest/v1/labels` - Etiket listesini getirir

### Rate Limitler

- **Todoist API**: 60 istek/dakika
- **OpenRouter API**: Varies by model
- **Concurrent Requests**: 10 (yapılandırılabilir)

## 🧪 Testler

Testleri çalıştırmak için:

```bash
# Tüm testleri çalıştır
npm test

# Testleri izlemek için
npm run test:watch

# Test kapsamı raporu
npm run test -- --coverage
```

## 📊 Yapı

```
src/
├── api/
│   ├── todoist-client.ts      # Todoist API istemcisi
│   └── types.ts               # API tip tanımları
├── services/
│   ├── task-service.ts        # Task işlemleri
│   ├── ai-service.ts          # AI entegrasyonu
│   ├── subtask-service.ts     # Subtask oluşturma
│   └── date-service.ts        # Tarih işlemleri
├── utils/
│   ├── error-handler.ts       # Hata yönetimi
│   ├── rate-limiter.ts        # Rate limit yönetimi
│   └── logger.ts              # Loglama
├── models/
│   ├── task.ts                # Task modeli
│   └── subtask.ts             # Subtask modeli
├── config/
│   └── config.ts              # Konfigürasyon
└── index.ts                   # Ana uygulama
```

## 🔒 Güvenlik ve Depo Temizliği

- **API Token Güvenliği**: Gerçek token'lar `.env` dosyasında saklanır ve Git tarafından takip edilmez
- **Ortam Değişkenleri**: Hassas veriler `.gitignore`'a eklenerek korunur
- **CORS Yapılandırması**: Güvenlik önlemleri alınır
- **Input Validation**: Girdi doğrulama ile güvenlik kontrolleri yapılır
- **Rate Limit Koruması**: API limitlerini aşmamak için akıllı yönetim

### Token & Duyarlı Bilgi Yönetimi

- Gerçek API token'ları `archive/` dizininde güvenli bir şekilde saklanır
- `.env` dosyası `.gitignore`'a eklenerek Git'e commitleme engellenir
- Kullanıcıların kendi token'larını kullanması için `.env.example` dosyası sağlanır

## 🧹 Depo Temizlik (Cleanup) Yönergesi (Özet)

Depo bakım süreci için adımlar (detaylı workflow `repo-cleanup.chatmode.md` içinde):

1. `git status` ile durum kontrolü
2. `find` komutu ile arşivlenecek geçici dosyaları listeleme
3. `archive/` klasörüne log / taslak / geçici dosyaları taşıma
4. `.gitignore` güncelleme (dist/ hariç tutulur, izlenir)
5. Duyarlı veri taraması: `grep -rE '(api[_-]?key|token|password|secret|private[_-]?key|access[_-]?token)' .`
6. Build + test (`npm run build`, `npm test`)
7. Conventional commit mesajı ile commit
8. `git push` + README bakım notu ekleme

## 🚀 Dağıtım

### Docker

```bash
# Docker image oluştur
docker build -t todoist-subtask .

# Container çalıştır
docker run -d --name todoist-subtask -p 3000:3000 \
  -e TODOIST_API_TOKEN=your_real_todoist_token \
  -e OPENROUTER_API_KEY=your_real_openrouter_key \
  todoist-subtask
```

### Production

```bash
# Uygulamayı build et
npm run build

# Production'da çalıştır
npm start
```

## 📈 Performans

- **Rate Limit**: 60 istek/dakika (Todoist)
- **Retry Mekanizması**: Üçlü deneme ile hata yönetimi
- **Caching**: Önbellekleme ile performans optimizasyonu
- **Async Processing**: Paralel işlemler ile verimlilik

## 🔄 Yol Haritası (Roadmap)

- [ ] Etkileşimli tarih sürükle-bırak zaman çizelgesi
- [ ] Tahmini sürelerin AI ile otomatik kalibrasyonu
- [ ] Label bazlı otomatik öncelik profili
- [ ] Offline cache
- [ ] Websocket ile canlı güncelleme

## 🤝 Katkı

Katkılarınızı memnuniyetle karşılıyoruz!

1. Bu repoyu forklayın
2. Yeni bir branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Değişikliklerinizi yapın
4. Commit yapın (`git commit -m 'Add amazing feature'`)
5. Branch'i pushlayın (`git push origin feature/amazing-feature`)
6. Pull request oluşturun

## 📄 Lisans

Bu proje MIT lisansı ile dağıtılmaktadır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.

## 🆘 Destek & İletişim

Sorular veya katkı için:

1. Önce mevcut konuları inceleyin: https://github.com/cenktekin/todoist-subtask-generator/issues
2. Uygun değilse yeni bir Issue açın (adımlar, beklenen/gerçek davranış, loglar)
3. Öneri / feature talebi için kısa başlık + açıklama yeterli

**Geliştirici**: Cenk Tekin  
**GitHub**: https://github.com/cenktekin  
**Proje**: https://github.com/cenktekin/todoist-subtask-generator  
**E‑posta**: cenktekin@duck.com  
**Buy Me a Coffee**: https://buymeacoffee.com/cenktekin  

Proje hoşuna gittiyse ⭐ vererek veya destek olarak motive edebilirsin.

---

**Not**: Bu uygulama Todoist API v1 kullanılarak geliştirilmiştir. API değişiklikleri olduğunda güncelleme yapılması gerekebilir.