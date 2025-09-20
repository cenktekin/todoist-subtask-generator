# Proje Yol Haritası ve Sprint Planı

Bu doküman proje için genişletilmiş yol haritası, epikler, user story'ler, kabul kriterleri ve sprint planını içerir. README içindeki özet sadece başlıkları gösterir; operasyonel detaylar burada yönetilir.

## 🎯 Vizyon

"Todoist üzerinde karmaşık görevleri daha yönetilebilir hale getiren, öğrenen (adaptive) bir AI destekli planlama ve alt görev oluşturma katmanı sağlamak; kullanıcının zihinsel yükünü azaltırken görünürlüğü ve öngörülebilirliği artırmak."

## 🗂 Epikler

1. Zaman Çizelgesi & Etkileşimli Planlama (Timeline UX)
2. Adaptif AI Süre & Öncelik Tahmini (Adaptive Intelligence)
3. Gelişmiş Subtask Stratejileri & Otomasyon (Automation Layer)
4. İş Birliği & Paylaşım (Collaboration)
5. Analitik & Raporlama (Insights)
6. Performans, Güvenilirlik & Dayanıklılık (Hardening)
7. Güvenlik & Uyumluluk (Security & Compliance)
8. Geliştirici Deneyimi & CI/CD (DevEx)
9. Mobil / Offline Kullanılabilirlik (Offline & Mobility)
10. Uzatma Ekosistemi (Plugin / Extension Hooks)
11. Akıllı Takvim Entegrasyonu & Gün Planlama (Smart Calendar Planning)

---

## 1. Epik: Zaman Çizelgesi & Etkileşimli Planlama
AMAÇ: Kullanıcıların alt görevleri sürükle-bırak ile günlere yeniden dağıtabilmesi ve yük dengesini görselleştirmesi.

### User Story 1.1: Drag & Drop Günlük Dağıtım
"Bir kullanıcı olarak zaman çizelgesi modalinde subtasks'ları bir günden başka bir güne sürükleyip bırakmak istiyorum ki yükü dengeli dağıtabileyim."
Kabul Kriterleri:
- Sürükle bırak sonrasında due date anlık güncellenir (optimistic UI + rollback).
- Todoist API güncellemesi hata verirse UI uyarı badge'i gösterir ve eski duruma döner.
- Hafta sonu dahil değilse sürükleme hafta sonuna izin vermez (opsiyonel override). 

### User Story 1.2: Günlük Kapasite Göstergesi
- Her gün için toplam tahmini süre (subtask duration sum) ve kapasite (%) barı.
- % > 100 olduğunda kırmızı ton, % 70–100 sarı, <70 yeşil.

### User Story 1.3: Otomatik Yeniden Dağıt (Rebalance)
- "Rebalance" butonu tıklanınca seçili stratejiye göre (equal / weighted) yeniden dağıtım önerisi preview modunda gösterilir, kullanıcı onaylarsa commit edilir.

### Teknik Notlar:
- Frontend: Virtualized list + drag handles.
- Backend: PATCH queue (rate limit dostu toplu güncelleme).

---

## 2. Epik: Adaptif AI Süre & Öncelik Tahmini
AMAÇ: Sistemin kullanıcı davranışından öğrenerek daha isabetli süre ve öncelik tahmini yapması.

### User Story 2.1: Süre Tahmini Öğrenmesi
- Tamamlanan subtasks için gerçekleşen süre (opsiyonel manuel input) ile model basit regresyonla güncellenir.
- Minimum veri eşiği: 20 tamamlama.

### User Story 2.2: Öncelik Profil Kalibrasyonu
- Kullanıcı belirli tür başlıklara sıklıkla yüksek öncelik veriyorsa AI çıktılarında ağırlık uygulanır.

### User Story 2.3: Confidence Skoru
- Her tahminde 0–1 arası güven skoru; düşük ise UI “düşük güven” etiketi.

### Teknik Notlar:
- Baseline: Basit ağırlıklandırılmış moving average + keyword weighting.
- Gelecek: Lokal küçük embedding + HTTP fallback.

---

## 3. Epik: Gelişmiş Subtask Stratejileri & Otomasyon
### User Story 3.1: Kurala Dayalı Otomatik Alt Görev Şablonları
- Ör: Görev başlığı "Rapor" içeriyorsa otomatik 3 alt görev şablonu ekle.

### User Story 3.2: Dinamik Weighted Distribution
- Weighted modda süre tahminine göre dinamik weight.

### User Story 3.3: SLA / Deadline Geri Sayım Uyarıları
- Kalan gün / planlanmış toplam süre oranına göre risk uyarısı.

---

## 4. Epik: İş Birliği & Paylaşım
### User Story 4.1: Paylaşılabilir Plan Linki
- Salt okunur anonim token bazlı paylaşım URL'si.

### User Story 4.2: Export PDF / Markdown
- Kullanıcı schedule'ı tek tuşla Markdown veya PDF’e aktarır.

### User Story 4.3: Not Alanı
- Her subtaska kısa not (sync Todoist comment API ile).

---

## 5. Epik: Analitik & Raporlama
### User Story 5.1: Burndown / Completion Trend
- Gün bazlı tamamlanan subtask grafiği.

### User Story 5.2: Tahmin vs Gerçekleşen Süre Karşılaştırma
- Chart + hata oranı (%) metriği.

### User Story 5.3: Tahmin Kalitesi Dashboard'u
- Son 30 gün MAPE / MAE.

---

## 6. Epik: Performans, Güvenilirlik & Dayanıklılık
### User Story 6.1: API Çağrı Kuyruk Sistemi
- Rate limit yaklaşırken otomatik jitter + queue.

### User Story 6.2: Local Cache Katmanı
- LRU + ETAG desteği; offline modun temelini hazırlar.

### User Story 6.3: Health Endpoint
- `/healthz` AI, Todoist, internal queue durum raporu.

---

## 7. Epik: Güvenlik & Uyumluluk
### User Story 7.1: Secret Scan Pipeline
- GitHub Actions step; grep + trufflehog (opsiyonel).

### User Story 7.2: Audit Log
- Her subtask create/update işlemi audit tablosuna (dosya/JSON) eklenir.

### User Story 7.3: Config İmzası
- `.env` hash i CI build çıktısına loglanır (içerik değil, fingerprint).

---

## 8. Epik: Geliştirici Deneyimi & CI/CD
### User Story 8.1: GitHub Actions Pipeline
- İş akışı: install -> build -> test -> secret scan -> lint -> package artifact.

### User Story 8.2: Storybook / UI Docs (opsiyonel)
- UI bileşenleri için dokümantasyon.

### User Story 8.3: Test Matris Çalıştırma
- Node 18 / 20.

---

## 9. Epik: Mobil / Offline Kullanılabilirlik
### User Story 9.1: PWA Manifest
- Installable + basic offline shell.

### User Story 9.2: IndexedDB Offline Queue
- Offline oluşturulan subtasks online olunca senkron.

---

## 10. Epik: Uzatma Ekosistemi (Plugin Hooks)
### User Story 10.1: Hook Sistemi
- Lifecycle: `beforeSubtaskGenerate`, `afterScheduleCompute`.

### User Story 10.2: Harici Model Seçimi
- Model provider seçici (OpenRouter / Lokal / Dummy).

---

## 11. Epik: Akıllı Takvim Entegrasyonu & Gün Planlama (Smart Calendar Planning)
AMAÇ: Kullanıcının gerçek takvim boşluklarına göre subtask slot önerileri üretmek ve "Günümü Planla" aksiyonu ile AI destekli bütünsel bir günlük / çok günlük plan oluşturmak.

### User Story 11.1: Takvim Bağlantısı (OAuth)
"Bir kullanıcı olarak Google / Outlook takvimimi bağlamak istiyorum ki sistem güncel boş zamanlarımı görebilsin."
Kabul Kriterleri:
- OAuth flow (read-only) tamamlanır; token güvenli saklanır (şimdilik dosya/ şifrelenmiş storage opsiyonlu).
- Bağlantı durumu UI'da ikon / badge ile görünür.
- Kullanıcı tek tıkla bağlantıyı iptal edebilir (token revoke / silme).

### User Story 11.2: Free/Busy Analizi
- Seçilen tarih aralığı için 07:00–22:00 arasında mevcut boş bloklar çıkarılır.
- 5 dakikadan küçük boşluklar yok sayılır.
- Çakışan etkinlikler birleşik tek blok sayılır.

### User Story 11.3: Subtask Slot Önerileri
- Subtask oluşturma panelinde her subtask için öneri listesi: (Tarih + Başlangıç Saati + Süre + Uyuşma Skoru).
- Öneri skoru: (uygun blok yakınlığı + öncelik ağırlığı + deadline yakınlığı) normalleştirilmiş.
- Kullanıcı öneriyi seçtiğinde due + start metadata kaydedilir (start internal meta, Todoist comment veya local mapping). 

### User Story 11.4: "Günümü Planla" (Plan My Day)
"Bir kullanıcı olarak bugün için uygun zaman bloklarına görevlerimi ve alt görevlerimi otomatik yerleştirmek istiyorum ki manuel planlama yüküm azalsın."
Kabul Kriterleri:
- Kullanıcı hedef çalışma aralığı (ör. 09:00–18:00) ve max derin odak blok sayısı ayarlar.
- LLM + heuristics: Önce yüksek öncelik + yaklaşan deadline + odak gerektiren uzun subtasks.
- 25+ dakikayı aşan bloklar arasında otomatik 5 dakikalık break önerisi.
- Plan commit edilmeden önce önizleme paneli sunulur (simülasyon).
- Commit ile Todoist due'lar (ve gerekirse comment içine slot metadata) yazılır.

### User Story 11.5: Çok Gün / Uzun İş Segmentasyonu
- Süresi kullanıcı tarafından uzun iş olarak işaretlenen (örn. "Eğitim Modülü") görevler günlere bölünür (max günlük odak süresi eşiğine göre).
- Bölümler (Segment 1/5 vb.) alt görev açıklamasına eklenir.

### User Story 11.6: Kişisel Tercih Öğrenmesi
- Sabah (08–11) derin odak uyumluluğu > akşam ise uzun işler sabaha öncelikli yerleştirilir.
- 10 gün gözlem sonrası profil parametreleri (morning_focus_score) güncellenir.

### User Story 11.7: Plan Simülasyonu & Senaryo Karşılaştırma
- Kullanıcı varsayılan / yoğun odak / hafif gün modları arasında geçiş yaparak 3 senaryoyu hızla kıyaslayabilir.

### User Story 11.8: Çakışma Tespiti & Otomatik Yeniden Planlama
- Sonradan eklenen takvim event'i planlanmış subtask slotu ile çakışırsa uyarı + tek tık Auto-Reschedule.

### User Story 11.9: Dinlenme / Enerji Yönetimi
- LLM açıklaması: "Öğleden sonra enerji düşebilir, 15 dk mola ekledim." gibi rationale üretir (opsiyonel gösterim).

### User Story 11.10: ICS / Dışa Aktarım
- Oluşturulan plan .ics dosyası olarak indirilebilir.

### Teknik Notlar:
- Calendar API: İlk faz Google Calendar (free/busy endpoint) → Abstraction interface.
- Scheduling Algoritması: Constraint tabanlı greedy + (isteğe bağlı ileride) weighted interval scheduling.
- LLM Prompt Katmanı: Plan context + slot candidate list + constraint özet.
- Privacy: Raw event başlıkları lokal kalır; LLM'e sadece anonimleştirilmiş süre & blok meta gider (örn. EVENT_A, 30dk busy).
- Metadata Saklama: Subtask → internal map {taskId: {start, end}} + Todoist comment fallback.
- Retry & Rate Limit: Calendar calls exponential backoff.

### Başlangıç Metrikleri:
- Öneri kabul oranı (% kabul / toplam öneri gösterim)
- Plan üretim süresi (ms)
- Çakışma sonrası otomatik yeniden plan başarı oranı

---

## ⏱ Tahmini Seviyeler
- XS (≤0.5g), S (1g), M (2-3g), L (5g), XL (>5g) şeklinde story effort notasyonu (g = gün).

---

## 📌 Önceliklendirilmiş Backlog (Top 25)
| ID | Story | Epic | Effort | Priority |
|----|-------|------|--------|----------|
| 1 | Drag & Drop Günlük Dağıtım | 1 | L | P0 |
| 2 | Günlük Kapasite Göstergesi | 1 | M | P0 |
| 3 | Rebalance Önerisi | 1 | M | P0 |
| 4 | Weighted Dinamik Weight | 3 | M | P1 |
| 5 | Süre Tahmini Öğrenmesi | 2 | L | P1 |
| 6 | Öncelik Profil Kalibrasyonu | 2 | M | P1 |
| 7 | Confidence Skoru | 2 | S | P2 |
| 8 | API Çağrı Kuyruk Sistemi | 6 | M | P0 |
| 9 | Local Cache Katmanı | 6 | M | P1 |
| 10 | Health Endpoint | 6 | S | P1 |
| 11 | Secret Scan Pipeline | 7 | S | P0 |
| 12 | Audit Log | 7 | S | P2 |
| 13 | GitHub Actions Pipeline | 8 | M | P0 |
| 14 | Test Matris (Node 18/20) | 8 | S | P1 |
| 15 | PWA Manifest | 9 | S | P2 |
| 16 | Offline Queue | 9 | M | P2 |
| 17 | Hook Sistemi | 10 | M | P2 |
| 18 | Harici Model Seçimi | 10 | M | P3 |
| 19 | Burndown Grafiği | 5 | M | P2 |
| 20 | Tahmin vs Gerçekleşen Rapor | 5 | M | P2 |
| 21 | PDF / Markdown Export | 4 | S | P2 |
| 22 | Paylaşılabilir Plan Linki | 4 | M | P2 |
| 23 | Not Alanı (Todoist Comments) | 4 | S | P3 |
| 24 | Rebalance Preview UI | 1 | S | P0 |
| 25 | dist Build Integrity Check | 8 | XS | P1 |
| 26 | Takvim OAuth Bağlantısı | 11 | M | P0 |
| 27 | Free/Busy Analizi | 11 | M | P0 |
| 28 | Subtask Slot Önerileri | 11 | L | P0 |
| 29 | Günümü Planla (LLM) | 11 | L | P0 |
| 30 | Çok Gün Segmentasyonu | 11 | M | P1 |
| 31 | Kişisel Tercih Öğrenmesi | 11 | M | P2 |
| 32 | Çakışma Auto-Reschedule | 11 | M | P2 |
| 33 | Plan Simülasyon Modları | 11 | S | P2 |
| 34 | ICS Export | 11 | S | P3 |

---

## 🏁 Sprint Çerçevesi
Sprint uzunluğu: 2 hafta. Kapasite varsayımı: 10 efektif gün.

### Sprint 1 (Temel UX + Güvenlik + CI)
Hedef: Etkileşimli planlamanın temelini atmak ve güvenli otomasyon.
- Story 1 (L)
- Story 2 (M)
- Story 24 (S)
- Story 11 (S)
- Story 13 (M)
- Story 25 (XS)
Toplam: ~ L(5) + M(3+3) + S(2+2) + XS(0.5) ≈ 15.5 nominal => Böl ve temsil: Drag & Drop L → iki parçaya ayrılabilir (UI iskeleti + persist katmanı).

Sprint 1 Ayrıştırma:
1.1 UI Grid & Virtualization (M)
1.2 Drag Gesture & Hover Gün/Günlük Highlight (S)
1.3 Persist & Optimistic Update (S)
1.4 Error Rollback & Retry (S)
=> Bu parçalama ile Sprint 1 feasible.

### Sprint 2 (Adaptif AI Başlangıç + Performans)
- Story 5 (L)
- Story 6 (M)
- Story 8 (M)
- Story 10 (S)
Risk tamponu: Story 7 (S) eklenebilir.

### Sprint 3 (Analitik + Otomasyon)
- Story 19 (M)
- Story 20 (M)
- Story 4 (M)
- Story 3 (M) — Rebalance algoritma finalize

### Sprint 4 (Offline + Plugin Altyapısı)
- Story 15 (S)
- Story 16 (M)
- Story 17 (M)
- Story 18 (M)

### Ötesi / Opsiyonel
- Story 21, 22, 23 kullanıcı talebine göre sıraya alınır.

### Sprint 5 (Takvim Entegrasyonu Başlangıç)
Hedef: Temel calendar data çekme ve slot öneri altyapısı.
- Story 26 (M)
- Story 27 (M)
- Story 28 (L) → Parçalama: API entegrasyon + öneri scoring + UI entegrasyon
- Story 33 (S)

### Sprint 6 (Plan My Day + Segmentasyon)
- Story 29 (L) → Parçalama: Prompt scaffolding / Heuristic scheduler / Commit pipeline
- Story 30 (M)
- Story 31 (M)
- Story 34 (S)

### Sprint 7 (Çakışma & Otomatik Yeniden Planlama)
- Story 32 (M)
- İyileştirme: Plan kalite metriki dashboard entegrasyonu


---

## 📐 Kabul Kriteri Örnek Şablonu
"AC1: ...", "AC2: ..."
Bir story tamam sayılmadan:
1. Tüm acceptance kriterleri geçti
2. Lint + test + build yeşil
3. README veya tasks.md güncel
4. UI regression yok (manuel smoke)

---

## 🔄 İzleme & Durum Etiketleri
- TODO
- IN_PROGRESS
- REVIEW
- BLOCKED
- DONE

Basit JSON durum dosyası (gelecekte): `status.json` planlanabilir.

---

## 🧪 Test Stratejisi
- Unit: Subtask dağıtım, tarih hesaplama.
- Integration: Todoist mock server.
- E2E (gelecek): Playwright ile temel akış (listele → preview → create → schedule).

---

## ⚙️ Teknik Borç / Refactor Notları
- AI prompt builder modülerleştirilecek
- DateService tarih normalizasyonu tek yerden
- Logger meta format unify

---

## 🛡 Riskler & Mitigasyon
| Risk | Etki | Olasılık | Mitigasyon |
|------|------|----------|------------|
| Rate limit spike | Yüksek | Orta | Queue + backoff |
| AI gecikmesi | Orta | Orta | Caching + skeleton UI |
| Drag & drop performansı | Orta | Düşük | Virtualization |
| Secret sızıntısı | Yüksek | Düşük | CI secret scan |
| Calendar API quota | Orta | Orta | Rate limit aware caching + incremental sync |
| LLM plan hataları | Orta | Orta | Simülasyon + insan onayı zorunlu commit |
| Gizlilik endişesi | Yüksek | Düşük | Anonim event özetleri, PII maskleme |

---

## 🔔 Güncelleme Prosedürü
1. Story ilerleyince ilgili bölümde etiket güncelle
2. Sprint sonunda kapanmamış M/L story carry-over notu ekle
3. README sadece yüksek seviye; detay burada korunur

---

## 📜 Değişim Günlüğü (tasks.md)
- 2025-09-20: İlk oluşturma, roadmap README'den taşındı, epik & sprint planı eklendi.
- 2025-09-20: Epik 11 (Takvim Entegrasyonu) ve ilgili user story'ler, backlog & sprint 5–7 planı eklendi.

---

Sorular / ekleme talepleri: Issue açın veya PR gönderin.