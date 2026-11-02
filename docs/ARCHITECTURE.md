# Mimari

- `App.tsx`: güvenli depodan oturum geri yükleme, arka planda erişim kontrolü ve uygulama yaşam döngüsünde token yenileme. RLS her sunucu isteğinde yetkiyi denetler.
- `src/lib/supabase.ts`: tek Supabase istemcisi. Native oturum SecureStore'da, web oturumu AsyncStorage'da saklanır. Dağıtım sürümü ayarlar eksikken veri girişine açılmaz.
- `src/services`: müşteri, parti, ödeme, yumurta türü ve SMS veri erişimi. `readAllRows` sunucu satır sınırına karşı sayfalı okumayı ortaklaştırır. `queryCache` aynı istekleri birleştirir ve sonuçları kısa süre bellekte tutar.
- `src/services/dataEvents.ts`: yerel yazma sonrası önbellek temizliği ve görünür ekranlara değişiklik bildirimi.
- `src/hooks/useFocusedRefresh.ts`: görünür listeleri odak, ilgili veri değişikliği ve uygulamaya dönüşte yeniler.
- `src/utils`: ortak telefon, tarih, para ve SMS durum kuralları.
- `src/screens` ve `src/components`: ekranlar, ortak form/kart bileşenleri ve beklenmeyen çizim hataları için hata sınırı.
- `modules/sim-sms`: Android SIM SMS yerel modülü. Mesaj gönderimi JavaScript onayı, sunucu claim'i, lease ve içerik eşleşmesi sonrasında yapılır; bildirim olmadan otomatik yeniden gönderme yoktur.
- `supabase/migrations`: sıralı şema ve RPC kaynağı. `database/migrations` aynı SQL dosyalarının elle kurulum kopyasıdır. İki dizinin eşitliği incelemede kontrol edildi.
- `scripts/build-android.ps1`: ortam/test kontrolü, özel kalıcı imza, Android ARM 32/64 bit release APK ve SHA-256 çıktısı.

Mevcut menü müşteri, yumurta kabulü, ödeme ve SMS akışlarını sunar. Gerçek makine/raf/yerleşim servisleri ileride kullanılabilmeleri için korunur; mevcut gezgin tarafından sunulmaz. Kullanılmayan ilk taslak bileşenler ve eski demo modelleri kaldırılmıştır. Geliştirmede kalan demo verileri üretimden bağımsızdır; dağıtım sürümü eksik sunucu ayarıyla demo kayda geçmez.

Yetki modeli tek işletmenin birden fazla yetkili kullanıcısıdır. Farklı işletmeler arasında tenant ayrımı bulunmaz. Çevrimdışı yazma kuyruğu ve kabul/ödeme için tek transaction mevcut değildir; ayrıntılar RELEASE_REVIEW.md içindedir.
