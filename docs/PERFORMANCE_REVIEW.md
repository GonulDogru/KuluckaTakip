# Açılış ve performans incelemesi

26 Ekim 2026

Bu belge ilk performans düzenlemesinin kaydıdır. Sonraki 1.1.0 sürümünde büyük liste okumaları sayfalandırıldı ve ek kod temizliği yapıldı; güncel kapsam ve sınırlamalar [RELEASE_REVIEW.md](RELEASE_REVIEW.md) içindedir.

## Sayfa geçişleri için ek düzeltme

- Ortak müşteri, parti, ödeme, yumurta türü ve ana sayfa sorguları 30 saniye bellekte tutulur. Aynı anda yapılan aynı sorgular tek istek kullanır. Bu önbellek diske yazılmaz.
- Ana sayfa açıldığında sekmelerin ortak verileri önceden istenir. Listeden bilinen bir kaydın detayı için aynı kayıt tekrar indirilmez.
- Müşteri, yumurta ve SMS listeleri daha önce başarıyla yüklendiyse, yenilenirken mevcut içerik görünür kalır.
- Yazma işlemleri ve elle yenileme önbelleği temizler. Hesap değişiminde hem önbellek hem gezinme ekranları sıfırlanır. Temizlemeden önce başlamış bir sorgu eski veriyi önbelleğe geri koyamaz.
- SMS durum sorguları önbelleğe alınmaz; gönderim ve sahiplenme akışı sunucudan denetlenmeye devam eder.
- Uygulamanın ilk açılışında henüz alınmamış veriler için bağlantı beklenebilir. Başka cihazlarda yapılan değişiklikler önbellek süresi içinde gecikmeli görülebilir; listede elle yenileme anında yeni sorgu gönderir.
- TypeScript kontrolü ve 16 mock tabanlı regresyon testi geçti.

## Düzeltilen sorunlar

- Kayıtlı oturum SecureStore'dan okunarak ana sayfa açılır. Token yenileme ve erişim sorgusu ekranı bekletmez. İlk giriş ve gerçekten sonlandırılmış oturumlar giriş ekranını kullanır.
- Token yenilenmesi erişim sonucunu sıfırlamaz. Erişim sorgusu oturum nesnesi yerine kullanıcı kimliği değiştiğinde çalışır. Açık bir yetki reddi giriş ekranına yönlendirir; bağlantı hatası kayıtlı oturumu düşürmez. Sunucudaki RLS kuralları veri erişimini denetlemeye devam eder.
- Yerel oturum okuması geç tamamlanırsa daha önce gelen çıkış olayını geri alamaz.
- Supabase token yenilemesi telefonun ön plan/arka plan durumuna bağlandı.
- Müşteri detayında partiler ve ödemeler sunucuda müşteri kimliğine göre süzülür. Parti ödemeleri ve tek ödeme sorgusu da yalnız ilgili kayıtları ister.
- Müşteri ve yumurta listeleri, başka ekran açıkken veri olayları için arka planda tekrar sorgu göndermez. Ekrana dönünce odak olayı verileri yeniler.
- Yumurta listesinde her satırda tüm müşterileri, türleri ve ödemeleri taramak yerine önceden hesaplanan haritalar kullanılır.
- Yumurta listesinde başarısız istek artık hata gösterir ve yükleme/yenileme göstergelerini kapatır.

## İncelemede kalan noktalar

- Ana sayfanın kullandığı `get_dashboard_summary` RPC'si çalışma alanında zaten bulunuyordu. Canlı Supabase'e ilgili migration'ın uygulanmış olduğu bu incelemede doğrulanmadı. Uygulama bu fonksiyona ihtiyaç duyar.
- Genel müşteri/parti listeleri ve müşteri özetleri hâlâ toplu veri okuyor. Büyük veri hacminde sayfalama ve sunucuda müşteri özeti hesaplama gerekir; canlı kayıt sayısı ve sorgu planları ölçülmedi. Supabase satır sınırı da bu listelerde ayrıca değerlendirilmelidir.
- Makine, raf ve çıkım sepeti ekranları mevcut `AppNavigator` içinde kayıtlı değil. İşlevleri korunarak bırakıldı; kullanım gereksinimi belirlenmeden silinmemeli.
- `PlaceholderScreen` ve ana sayfanın kullanmadığı `getDailyTasks` mevcut. Bunlar açılışta çalışmadığı için tespit edilen gecikmenin doğrudan nedeni değiller.

## Doğrulama

- `npx.cmd tsc --noEmit`
- `node --test session-regression.test.cjs`: 10 test geçti. Yerel oturumla açılış, token yenileme, ağ hatası, yetki reddi, çıkış, uygulama yaşam döngüsü ve sunucuda sorgu filtreleme için mock tabanlı regresyon testleri.
- `npx.cmd expo export --platform android --no-bytecode --output-dir .verification-export`: JavaScript paketleme başarılı. Standart Hermes bytecode denemesi ortamda `hermesc.exe: permission denied` nedeniyle tamamlanamadı. Üretim ayarlarında bytecode kapatılmadı; alternatif komut yalnız doğrulama için kullanıldı.
- Fiziksel telefonda süre ölçümü ve canlı Supabase entegrasyon testi yapılmadı. Kod değişikliklerinin telefonda kullanılması için güncellenmiş uygulama paketi veya geliştirme sürümü gerekir.

## Başvurular

- [Expo SDK 57 belgeleri](https://docs.expo.dev/versions/v57.0.0/)
- [Supabase React Native oturum ve AppState akışı](https://supabase.com/docs/guides/auth/quickstarts/react-native)
