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

## � Ekran Görüntüleri

### Web Arayüzü - Ana Ekran
![Ana Ekran](./Ekran%20Görüntüsü_20250920_223612.png)
*Modern ve temiz web arayüzü ile görev yönetimi*

### Görev Filtreleme ve Seçim
![Görev Filtreleme](./Ekran%20Görüntüsü_20250920_223629.png)  
*Proje, etiket, öncelik ve tarih bazlı gelişmiş filtreleme seçenekleri*

### Subtask Önizleme
![Subtask Önizleme](./Ekran%20Görüntüsü_20250920_223651.png)
*AI tarafından üretilen subtask'ların önizlemesi ve düzenleme seçenekleri*

### Akıllı Zaman Hesaplama
![Zaman Hesaplama](./Ekran%20Görüntüsü_20250920_223746.png)
*"15 gün süre ayıracağım" gibi doğal dil işleme ile akıllı subtask sayısı hesaplama*

## �📋 Gereksinimler

- Node.js 18.0.0 veya üstü
### Required Environment Variables
- Todoist API Token (https://todoist.com/app/integrations/api-token)
| `TODOIST_API_TOKEN` | Todoist API token (Unified API v1 veya eski REST v2). Uygulama bağlantıyı `/projects` isteği ile test eder. Placeholder token bırakırsanız 401 alırsınız. |

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

> Eğer önceki `.env` dosyanızı güvenlik için `archive/` altına taşıdıysanız, test için yeniden oluşturmak adına bu adım yeterlidir. `archive/` içindeki eski dosyayı geri getirmenize gerek yok; sadece gerekli iki zorunlu değişkeni (`TODOIST_API_TOKEN`, `OPENROUTER_API_KEY`) yeni `.env` içine girin.

4. **.env dosyasını düzenleyin**:
  - Kendi Todoist API token'ınızı kopyalayın: https://todoist.com/app/integrations/api-token
  - Kendi OpenRouter API anahtarınızı oluşturun: https://openrouter.ai/keys
  - `.env` dosyasını düzenleyerek kendi token'larınızı ekleyin
  - **ÖNEMLİ**: Gerçek token'larınızı asla Git'e commitlemeyin!
  - Ek opsiyonel değerler için `.env.example` içindeki yorumları okuyun (model, log seviyesi, batch ayarları vs.)

5. **Uygulamayı başlatın**:
```bash
# Web arayüzü + API birlikte
npm run dev

# Sadece çekirdek servisleri (web olmadan) çalıştırmak istersen
npm run dev:core
```

## 📖 Kullanım

### 1. Web Arayüzü (Önerilen Yol)

Uygulamanın ana kullanım şekli modern web arayüzüdür.

1. Ortam değişkenlerini `.env` içinde tanımlayın (`TODOIST_API_TOKEN`, `OPENROUTER_API_KEY`)
2. Geliştirme sunucusunu başlatın (web arayüzü dahil):
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

### Todoist API Sürüm Notu

Todoist yakın zamanda REST v2 + Sync v9 birleşimini sağlayan **Unified API v1** (örn: `https://api.todoist.com/api/v1/...`) yapısını duyurdu. Bu projede varsayılan `baseUrl` halen `https://api.todoist.com/rest/v2` olarak bırakıldı çünkü mevcut kod mantıksal olarak REST şemasına göre yazıldı ve v1 geçişi sırasında minimal değişiklik hedeflendi. 

`src/api/todoist-client.ts` içindeki istemci aşağıdaki şekilde davranır:
* `config.todoist.baseUrl` `/api/v1` içerirse pagination'lı `{ results: [], next_cursor }` yapısını algılar ve normalize eder.
* `/rest/v2` kullanımında eski düz array formatını bekler.
* Placeholder token (ör: `your_todoist_api_token_here`) tespit edilirse konsola uyarı yazar ve 401 durumunda özel açıklama verir.

Gelecekte Unified API v1'e tam geçiş için yapılabilecekler (`tasks.md` içine aktarılabilir):
1. `baseUrl` varsayılanını `/api/v1` yap
2. Tüm listeleme çağrılarını `fetchAllPages` kullanarak tamamını çek (şu an sadece ilk sayfa gerektiğinde yeterli)
3. Yeni `/api/v1/tasks/filter` endpoint'ini gelişmiş arama için entegre et (REST v2 `filter` parametresi kalktı)
4. Gerekirse proje / label CRUD operasyonları için v1 spesifik genişletmeler ekle

Hızlı test için örnek istek (token ile):
```bash
curl -H "Authorization: Bearer $TODOIST_API_TOKEN" https://api.todoist.com/rest/v2/projects
```
veya v1:
```bash
curl -H "Authorization: Bearer $TODOIST_API_TOKEN" 'https://api.todoist.com/api/v1/projects?limit=1'
```

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

### Son Bakım Kaydı (Maintenance Log)

- 2025-09-20: `node_modules/` dizini ilk commit sırasında yanlışlıkla repoya eklenmişti. `.gitignore` güncellendi ve `git rm -r --cached node_modules` ile versiyon kontrolünden çıkarıldı. Yeni klonlayan kullanıcılar `npm install` sonrasında bağımlılıkları lokal olarak oluşturabilir. Eğer repoyu fork'ladıysanız ve kendi fork'unuzda da aynı problem varsa aynı adımları uygulayın.

İsteğe bağlı (boyutu küçültmek için geçmişi temizleme):

```bash
# NOT: Bu işlem commit hash'lerini değiştirir. Paylaşımlı repo ise ekip ile koordine edin.
pip install git-filter-repo  # veya brew install git-filter-repo
git filter-repo --path node_modules --invert-paths
git push --force origin main
```

Alternatif hızlı yöntem (BFG Repo-Cleaner):

```bash
java -jar bfg.jar --delete-folders node_modules --delete-files node_modules --no-blob-protection .
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force origin main
```

Eğer proje henüz yaygın paylaşılmadıysa history rewrite güvenlidir; aksi halde sadece mevcut durumun temiz kalması yeterlidir.

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

Artık detaylı yol haritası, epik ayrımları, user story'ler, kabul kriterleri ve sprint planı `tasks.md` dosyasına taşındı.

Özet (yüksek seviye başlıklar):
* Zaman Çizelgesi UX geliştirmeleri
* AI zekâ katmanı (öğrenen süre & öncelik tahmini)
* İş birliği / paylaşım özellikleri
* Analitik & raporlama
* Performans ve güvenilirlik sertleşmesi
* Geliştirici deneyimi ve CI/CD

Detaylar için: `tasks.md`

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

**Not**: Uygulama REST v2 ile uyumlu çalışacak şekilde başlatıldı; istemci Unified API v1 yanıt biçimini de otomatik normalize eder. API kırıcı değişikliklerinde `todoist-client.ts` güncellenmelidir.