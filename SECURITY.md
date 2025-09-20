# Güvenlik Politikası

## Desteklenen Sürümler

Güvenlik güncellemelerini şu sürümlerde sağlıyoruz:

| Sürüm   | Destekleniyor          |
| ------- | ---------------------- |
| 1.0.x   | :white_check_mark:     |
| < 1.0   | :x:                    |

## Güvenlik Açığı Bildirme

Güvenlik açığı keşfettiğinizde, lütfen aşağıdaki süreci takip edin:

### 🚨 Acil Durumlar

**Herkese açık issue AÇMAYIN> LICENSE << 'EOF'
MIT License

Copyright (c) 2025 Cenk Tekin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF* Güvenlik açıkları hassas bilgilerdir ve gizli kalmalıdır.

### 📧 Raporlama Süreci

1. **E-posta Gönderin**: cenktekin@duck.com
2. **Konu Başlığı**: `[SECURITY] Todoist Subtask Generator - [Kısa Açıklama]`
3. **İçerik**: Aşağıdaki bilgileri ekleyin

### 📋 Rapor İçeriği

Lütfen raporunuzda şu bilgileri bulundurun:

```
Güvenlik Açığı Raporu

1. AÇIKLAMA
   - Açığın kısa açıklaması
   - Etkilediği bileşenler

2. ETKİ DERECESİ
   - Düşük / Orta / Yüksek / Kritik
   - Potansiel zarar açıklaması

3. YENİDEN ÜRETİM ADIMLARI
   - Adım adım talimatlar
   - Gerekli ortam bilgileri
   - Test kodu (varsa)

4. TEKNİK DETAYLAR
   - Etkilenen dosyalar/fonksiyonlar
   - Çözüm önerileri (varsa)
   - İlgili log kayıtları

5. İLETİŞİM
   - Adınız (isteğe bağlı)
   - En iyi iletişim yönteminiz
   - Tercih ettiğiniz takip süreci
```

### ⏱️ Yanıt Süreleri

| Önem Derecesi | İlk Yanıt | Durum Güncellemesi | Çözüm Hedefi |
|---------------|-----------|-------------------|----------------|
| Kritik        | 24 saat   | Günlük            | 7 gün         |
| Yüksek        | 48 saat   | Haftalık          | 30 gün        |
| Orta          | 5 gün     | 2 haftada bir     | 90 gün        |
| Düşük         | 10 gün    | Aylık             | 180 gün       |

## 🛡️ Güvenlik En İyi Uygulamaları

### Geliştirici Güvenliği

- **API Anahtarları**: Asla kodda sabit değer olarak yazmayın
- **Environment Variables**: `.env` dosyasını `.gitignore`'a ekleyin
- **Logging**: Hassas bilgileri log'lamayın
- **Input Validation**: Tüm user input'larını validate edin

### Deployment Güvenliği

- **HTTPS**: Production'da sadece HTTPS kullanın
- **Rate Limiting**: API endpoint'lerini rate limit ile koruyun
- **Dependencies**: Düzenli olarak `npm audit` çalıştırın
- **Secrets Management**: Production secrets'ları güvenli ortamda saklayın

## 🔍 Bilinen Güvenlik Uygulamaları

### Mevcut Korumalar

✅ **API Token Koruması**: Real token'lar asla repository'de saklanmaz  
✅ **Rate Limiting**: Todoist ve OpenRouter API'leri için rate limit  
✅ **Input Sanitization**: User input'larında XSS koruması  
✅ **Error Handling**: Detaylı hata mesajları production'da gizlenir  
✅ **CORS**: Cross-origin request'ler kısıtlanır  

### Periyodik Güvenlik Kontrolleri

- **Weekly**: `npm audit` dependency scan
- **Monthly**: Code review for security patterns
- **Quarterly**: Penetration testing (manual)
- **Yearly**: Full security audit

## 📞 İletişim

### Güvenlik Ekibi

- **Primary Contact**: cenktekin@duck.com
- **PGP Key**: Talep üzerine sağlanır
- **Response Language**: Türkçe / English

### Şeffaflık

Güvenlik açıkları çözüldükten sonra:

1. **Public Disclosure**: Çözüm yayınlandıktan 90 gün sonra
2. **Credits**: Araştırmacıya (isterse) teşekkür notları
3. **CVE**: Gerekirse CVE numarası alınır
4. **Release Notes**: Güvenlik güncellemeleri duyurulur

## 🏆 Hall of Fame

Güvenlik açığı bildiren araştırmacılar (izinleri ile):

*Henüz bildirim yapılmadı*

---

**Son Güncelleme**: 20 Eylül 2025  
**Sürüm**: 1.0  
**İletişim**: cenktekin@duck.com
