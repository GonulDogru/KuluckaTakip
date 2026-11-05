# 1.1.3 — Kayıt, ödeme, SMS ve klavye düzeltmeleri

5 Kasım 2026 · Android versionCode 5 · Android 7+ · ARM 32/64 bit.

- Yeni müşteri telefon alanı, klavye açılması ve ekran boyutu değişmesi sonrasında yeniden ölçülüp görünür tutulur.
- SMS son satırına “Yalınayak Süs Tavukları 🐔” eklenir. Düzenleme ve tekrar kaydetmede imza çoğalmaz.
- Kabul ve ilk ödeme tek sunucu işlemiyle kaydedilir; bağlantı kopması sonrasındaki tekrarlar ikinci kayıt oluşturmaz.
- Ödeme düzeltme, gerekçeli iptal, fazla ödeme kontrolü ve değişiklik geçmişi eklendi.
- Kuluçka tarihi/durumu, tür/ırk ve müşteri/SMS bilgileri birlikte güncellenir; özel SMS metinleri korunur.
- SMS taslağı kurtarma, arşivden müşteri geri alma ve uygulamaya dönüşte ekran yenileme eklendi.
- Makine/raf/çıkım/teslim ekranları bu sürümün kapsamına alınmadı.

## APK seçimi

- `KuluckaTakip-1.1.3.apk`: standart dağıtım imzası; yeni telefonlar ve önceki standart APK ile kurulmuş telefonlar.
- `KuluckaTakip-1.1.3-mevcut-telefon-guncelleme.apk`: eski geliştirme imzasını koruyan güncelleme; önceki uyumlu güncelleme paketini kullanan telefonlar.

Mevcut uygulamayı kaldırmadan, telefondaki imzayla aynı seriye ait APK üzerinden güncelleyin. İmza uyuşmazlığında uygulamayı silmek yerine diğer uygun paketi kullanın. Her iki APK aynı uygulama kodunu içerir.

## Sunucu

Bu sürüm sırasıyla `20261105120000_flow_integrity.sql` ve `20261105130000_sms_signature.sql` migration’larını gerektirir. Eski istemcinin doğrudan ödeme/SMS taslağı yazma yöntemi artık kullanılmaz; tüm telefonlar yeni sürüme geçirilmelidir. Ayrıntılı davranış ve testler: [Akış düzeltmeleri](FLOW_FIXES_2026-11-05.md).

## Dağıtım doğrulaması

Her iki APK başarıyla üretildi; imzaları önceki 1.1.2 paketlerinin karşılık gelen imzalarıyla eşleşiyor. versionName 1.1.3, versionCode 5, minSdk 24, targetSdk 36 ve iki ARM mimarisi doğrulandı. APK imzası, 16 KB hizalama ve SHA-256 kontrolleri başarılı. İki paket aynı uygulama içeriğini ve güncel Hermes bundle’ını içeriyor. TypeScript ve 34 regresyon testi geçti.

İki sunucu migration’ı bağlı projeye uygulandı. Sonraki salt okunur kontrolde yeni RPC’ler, SMS imzası ve yetki kuralları doğrulandı. Müşteri/kabul/ödeme/SMS kayıt sayıları korundu; tarih, ödeme-müşteri eşleşmesi ve gönderilmemiş SMS imzası tutarsızlığı sıfır.

Bağlı Android telefon bulunmadığından cihaz kurulumu ve fiziksel klavye/SIM testi yapılmadı. APK telefona aktarılarak mevcut uygulamanın üzerine kurulmalıdır.
