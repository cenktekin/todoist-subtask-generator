# Katkıda Bulunma Rehberi

Todoist Subtask Generator projesine katkıda bulunmak istediğiniz için teşekkür ederiz! Bu rehber, katkı sürecini nasıl yönetebileceğiniz konusunda size yol gösterecektir.

## 🚀 Hızlı Başlangıç

### Ön Koşullar

- Node.js 18.0.0 veya üstü
- Git
- Todoist API token'ı (test için)
- OpenRouter API anahtarı (test için)

### Geliştirme Ortamını Kurma

1. **Repository'yi forklayın ve klonlayın**:
```bash
git clone https://github.com/YOUR_USERNAME/todoist-subtask-generator.git
cd todoist-subtask-generator
```

2. **Bağımlılıkları yükleyin**:
```bash
npm install
```

3. **Ortam değişkenlerini yapılandırın**:
```bash
cp .env.example .env
# .env dosyasını kendi API anahtarlarınızla düzenleyin
```

4. **Geliştirme sunucusunu başlatın**:
```bash
npm run dev
```

5. **Testleri çalıştırın**:
```bash
npm test
```

## 📋 Katkı Türleri

### 🐛 Hata Raporlama

Hata bulduğunuzda lütfen şu bilgileri içeren bir issue açın:

- **Hata Açıklaması**: Kısa ve net açıklama
- **Nasıl Yeniden Üretilir**: Adım adım talimatlar
- **Beklenen Davranış**: Ne olmasını bekliyordunuz
- **Gerçek Davranış**: Ne oldu
- **Ekran Görüntüleri**: Varsa ekleyin
- **Ortam**: OS, Node.js versiyonu, tarayıcı

### ✨ Özellik Önerisi

Yeni özellik önerileri için:

- **Özellik Açıklaması**: Ne yapmak istiyorsunuz
- **Motivasyon**: Neden bu özellik gerekli
- **Detaylı Açıklama**: Nasıl çalışması gerektiği
- **Alternatifler**: Düşündüğünüz başka çözümler

### 🔧 Kod Katkısı

1. **Issue açın**: Büyük değişiklikler için önce tartışalım
2. **Branch oluşturun**: `git checkout -b feature/amazing-feature`
3. **Kodlayın**: Aşağıdaki kurallara uygun şekilde
4. **Test edin**: Mevcut testler geçmeli, yenilerini ekleyin
5. **Commit yapın**: Conventional Commits formatında
6. **Pull Request açın**: Template'i doldurun

## 📝 Kodlama Standartları

### TypeScript

- **Tip Güvenliği**: `any` kullanmaktan kaçının
- **Interface'ler**: Veri yapıları için interface kullanın
- **Null Checks**: Defensive programming uygulayın

```typescript
// ✅ İyi
interface Task {
  id: string;
  title: string;
  dueDate?: string;
}

// ❌ Kötü
const task: any = { id: 1, name: "Test" };
```

### Kod Stili

- **ESLint**: Otomatik düzeltme için `npm run lint:fix`
- **Prettier**: Kod formatlama için `npm run format`
- **İsimlendirme**: camelCase kullanın
- **Yorumlar**: Karmaşık mantık için açıklayıcı yorumlar

### Commit Mesajları

Conventional Commits formatını kullanın:

```
type(scope): description

[optional body]

[optional footer]
```

**Tipler**:
- `feat`: Yeni özellik
- `fix`: Hata düzeltme
- `docs`: Dokümantasyon
- `style`: Kod formatı
- `refactor`: Kod yeniden düzenleme
- `test`: Test ekleme/düzeltme
- `chore`: Bakım işleri

**Örnekler**:
```
feat(ui): add task filtering by priority
fix(api): resolve rate limit handling issue
docs: update installation instructions
test(services): add subtask service tests
```

## 🧪 Test Yazma

### Unit Tests

```typescript
import { TaskService } from '../src/services/task-service';

describe('TaskService', () => {
  it('should filter tasks by priority', () => {
    const taskService = new TaskService();
    const result = taskService.filterByPriority(tasks, 4);
    expect(result).toHaveLength(2);
  });
});
```

### Test Kapsama

- **Minimum %80**: Test coverage hedefi
- **Critical Paths**: Ana işlevsellik mutlaka test edilmeli
- **Edge Cases**: Sınır durumları test edin

## 📁 Proje Yapısı

```
src/
├── api/           # External API clients
├── services/      # Business logic
├── utils/         # Helper functions
├── models/        # Data models
├── config/        # Configuration
└── web-server.ts  # Web server

tests/
├── api/
├── services/
└── utils/

public/            # Web UI assets
.github/           # GitHub templates
```

## 🔍 Code Review Süreci

### Pull Request Checklist

- [ ] Issue'ya referans var mı?
- [ ] Yeni testler eklendi mi?
- [ ] Mevcut testler geçiyor mu?
- [ ] Dokümantasyon güncellendi mi?
- [ ] Lint hatası yok mu?
- [ ] Breaking change var mı?

### Review Kriterleri

1. **Functionality**: Kod istenen işlevi yapıyor mu?
2. **Performance**: Performans problemi var mı?
3. **Security**: Güvenlik açığı var mı?
4. **Maintainability**: Kod okunabilir ve sürdürülebilir mi?
5. **Testing**: Yeterli test coverage var mı?

## 🚀 Release Süreci

### Versioning

Semantic Versioning (SemVer) kullanıyoruz:
- **MAJOR**: Breaking changes (1.0.0 → 2.0.0)
- **MINOR**: New features (1.0.0 → 1.1.0)
- **PATCH**: Bug fixes (1.0.0 → 1.0.1)

### Release Notları

Her release için:
- **Added**: Yeni özellikler
- **Changed**: Mevcut özelliklerde değişiklikler
- **Deprecated**: Kaldırılacak özellikler
- **Removed**: Kaldırılan özellikler
- **Fixed**: Düzeltilen hatalar
- **Security**: Güvenlik güncellemeleri

## 🛡️ Güvenlik

### Güvenlik Açığı Bildirimi

Güvenlik açığı bulduysanız:
1. **Herkese açık issue AÇMAYIN**
2. **cenktekin@duck.com** adresine e-posta gönderin
3. Sorunu detaylı açıklayın
4. Mümkünse çözüm önerisi ekleyin

### Güvenlik En İyi Uygulamaları

- API anahtarlarını code'a yazmayın
- Sensitive bilgileri log'lamayın
- Input validation yapın
- Rate limiting uygulayın

## 📞 İletişim ve Destek

### Sorularınız için

1. **README.md**: Önce dokümantasyonu okuyun
2. **Issues**: Mevcut sorunları kontrol edin
3. **Discussions**: Genel tartışmalar için
4. **E-posta**: cenktekin@duck.com

### Topluluk

- Saygılı ve yapıcı olun
- Code of Conduct'a uyun
- Yardımlaşmayı teşvik edin
- Öğrenmeye açık olun

## 🎯 Yol Haritası

Proje yol haritası için `tasks.md` dosyasına bakın. Katkıda bulunmak istediğiniz alanları seçebilirsiniz:

- **Frontend**: React/Vue migration
- **Backend**: API improvements
- **AI**: Better Turkish language processing
- **DevOps**: CI/CD improvements
- **Documentation**: Türkçe çeviriler

## 🙏 Teşekkürler

Her katkı, ne kadar küçük olursa olsun değerlidir. Bu projeyi daha iyi hale getirmeye yardım ettiğiniz için teşekkür ederiz!

---

Sorularınız için: [Issues](https://github.com/cenktekin/todoist-subtask-generator/issues) | [E-mail](mailto:cenktekin@duck.com)
