# Todoist Subtask Generator - Proje Mimarisi (Güncel)

## Genel Bakış
Todoist üzerindeki task'ları seçerek **Türkçe AI** yardımıyla mantıklı alt görevlere bölen, bunları **akıllı tarih dağıtımı** ile planlayan ve opsiyonel olarak bir **zaman çizelgesi (schedule)** çıkaran modern, web arayüzlü bir sistem.

Uygulama hem API tüketimi (Todoist) hem de AI modeli (OpenRouter) ile entegrasyon sırasında hata toleransına, rate limit uyumuna ve yeniden kullanılabilir servis katmanlarına odaklanır.

## Teknoloji Yığını
- **Backend**: Node.js + TypeScript (Katmanlı servis mimarisi)
- **HTTP İstemci**: Axios (retry & timeout ayarlı)
- **AI Entegrasyon**: OpenRouter (Türkçe prompt, JSON formatlı çıktı)
- **Frontend**: Vanilla JS + modern CSS (filtreleme & modal yapısı)
- **Loglama**: Winston / konsol + (opsiyonel dosya logları)
- **Test**: Jest
- **Paket Yönetimi**: npm
- **Build Çıktısı**: `dist/` (bilinçli olarak versiyon kontrolünde)

## Proje Yapısı
```
todoist-subtask/
├── src/
│   ├── api/
│   │   ├── todoist-client.ts      # Todoist API istemcisi
│   │   └── types.ts               # API tip tanımları
│   ├── services/
│   │   ├── task-service.ts        # Task işlemleri
│   │   ├── ai-service.ts          # AI entegrasyonu (Türkçe prompt + JSON parsing + fallback)
│   │   ├── subtask-service.ts     # Subtask üretim + tarih dağıtım stratejileri
│   │   └── date-service.ts        # Zaman çizelgesi (schedule) hesaplama
│   ├── utils/
│   │   ├── error-handler.ts       # Hata yönetimi
│   │   ├── rate-limiter.ts        # Rate limit yönetimi
│   │   └── logger.ts              # Loglama
│   ├── models/
│   │   ├── task.ts                # Task modeli
│   │   └── subtask.ts             # Subtask modeli
│   └── index.ts                   # Ana uygulama
├── tests/
│   ├── api/
│   ├── services/
│   └── utils/
├── config/
│   └── config.ts                  # Konfigürasyon
├── package.json
├── tsconfig.json
└── README.md
```

## Ana Fonksiyonlar

### 1. Task Çekme ve Filtreleme
- Todoist REST API'den task koleksiyonu çekilir
- Backend filtreleri: proje, etiket(ler), öncelik, tarih aralığı, arama
- Tarih modları: today, 7days, 30days, overdue, range, all
- Fazla sonuç geldiğinde frontend ek client-side süzgeç uygular

### 2. AI Subtask Oluşturma
- `AIService` Türkçe sistem prompt'u ile JSON dönen alt görevler üretir
- Alt görev sayısı isteğe bağlı sınırlandırılır
- Her alt görev: `content`, opsiyonel `due`, opsiyonel `priority`
- Yanıt JSON değilse temizleme & parse denemesi yapılır
- Fallback model denenir (ör: default başarısızsa)

### 3. Akıllı Tarih Dağıtımı
- Stratejiler: `equal`, `sequential`, `weighted`
- Weighted modunda önem dereceleri erken günlere çekilir
- Hafta sonu dahil / hariç seçilebilir
- Ana görevin due tarihi yoksa bugün baz alınır
- AI'nın önerdiği due varsa korunur; yoksa dağıtım hesaplanır

### 4. Hata & Dayanıklılık
- Axios timeout & error handling
- Todoist bağlantısı başarısız olsa bile AI fonksiyonları kısıtlı modda çalışabilir
- Rate limit aşımlarında bekleme stratejisi (gelecekte genişletilebilir)
- JSON format dışı AI çıktıları sanitize edilir

### 5. Zaman Çizelgesi (Schedule) Hesaplama
- `date-service` alt görevlerin tahmini sürelerini (heuristic) kullanır
- Mevcut subtask'lar varsa yeniden AI üretimi yapılmaz
- Günlük çalışma saatleri (`workDayStart`, `workDayEnd`, `dailyWorkHours`) parametreleri
- Çıktı: başlangıç / bitiş tarihi, toplam gün, toplam tahmini süre, gün bazlı alt görev tablosu

### 6. Öncelik Stratejileri
- `inherit`: Ana görev önceliği aynen aktarılır
- `distribute`: Görev sırasına göre aralıkta dağıtılır
- `constant`: Sabit değer kullanılır

## API Akışları

### Task Çekme Akışı
1. Kullanıcı kimlik doğrulaması
2. Todoist API'den task'ları çek
3. Task'ları filtrele ve sırala
4. Kullanıcıya task listesini göster

### Subtask Oluşturma Akışı
1. Kullanıcı web arayüzünden task seçer veya API üzerinden tetikler
2. Task detayları + due alınır
3. AI'ya Türkçe prompt ile istek atılır
4. Yanıt parse edilir, alt görevler tarih stratejisi ile güncellenir
5. Todoist'e ardışık şekilde (rate limit gözeterek) eklenir
6. Sonuç + hatalar döndürülür

### Schedule Akışı
1. Task detayları ve var olan subtask'lar çekilir
2. Subtask yoksa küçük limitli AI üretimi yapılır
3. Heuristik süre tahmini fonksiyonu uygulanır
4. Çalışma günleri boyunca dağıtım yapılır
5. Özet + timeline yapılandırılır

## Güvenlik ve Temizlik
- `.env` ve hassas dosyalar izlenmez
- Arşiv yaklaşımı: Silme yerine `archive/` altına taşıma
- Hassas veri taraması için regex grep komutları (bkz. README bölüm)
- `dist/` sürüm kontrolünde: hızlı "Load Unpacked" / dağıtım kolaylığı
- Log dosyaları commit öncesi arşivlenir

## Gelecek Geliştirme Başlıkları
- Drag & drop timeline düzenleme
- Otomatik süre tahmininde AI kalibrasyonu
- Websocket canlı güncellemeler
- Offline caching stratejisi

## Karar Gerekçeleri (Rationale)
- **Türkçe AI**: Kullanıcı odaklı deneyim ve domain diline uyum
- **dist takip**: Hızlı demo / paketlemeye hazır hali koruma
- **Arşivleme**: Deneysel çalışmaların kaybolmamasını sağlama
- **Katmanlı servis**: Test edilebilirlik ve sorumluluk ayrımı

## Riskler / Sınırlar
- Todoist API erişimi kesildiğinde tam işlevsellik kısıtlanır (yalnızca AI modları çalışır)
- AI JSON format dışına çıktığında parse hatası riskleri (sanitize ile azaltıldı)
- Süre tahmini heuristik; doğruluk garantisi yok

## Özet
Bu mimari; esnek, genişleyebilir ve bakım dostu bir yapı sunarken; Türkçe üretken AI, planlama ve filtreleme ihtiyaçlarını odaklı şekilde karşılar.