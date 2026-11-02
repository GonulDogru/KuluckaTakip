# 1.1.0 kod ve dağıtım incelemesi

26 Ekim 2026

## Uygulananlar

- Kullanılmayan PartyModal, eski ShelfMap/MachineCard demo bileşenleri, ShelfListScreen ve PlaceholderScreen kaldırıldı. Bunların eski demo verileri/modelleri ve kullanılmayan rota temizlendi. Beş kullanılmayan stil ve artık çağrılmayan günlük görev sorgusu kaldırıldı. Makine/raf alanındaki gerçek servisler ve operasyon ekranları gelecekteki işlevler olarak korundu; mevcut menüye yeni özellik eklenmedi.
- Kullanılmayan state/importlar kaldırıldı; TypeScript `noUnusedLocals` ve `noUnusedParameters` denetimleri etkinleştirildi. Para ayrıştırma ve SMS durum/gruplama tek yardımcıda toplandı.
- Müşteri ve yumurta listelerindeki tekrar eden odak/veri değişimi dinleyicileri ortak hook'a taşındı; uygulamaya arka plandan dönüldüğünde sunucu verisi yenilenir.
- Supabase çıkışı `scope: local` kullanır. Bir telefonda çıkış diğer cihazların refresh oturumlarını iptal etmez. Eksik sunucu yapılandırması release'te demo kayıt yazımına izin vermez. Durum çubuğu açık temaya göre ayarlandı.
- Müşteri, parti ve ödeme okumaları kararlı sıralamayla 200 kayıtlık sayfalarda tamamlanır. Tek müşteri/parti filtreleri sunucuda korunur. Müşteri özetleri ortak servis okumalarını kullanır. API `max_rows` ayarı en az 200 olmalıdır.
- SMS detayında artık bütün mesaj listesi alınmaz; yalnız kayıt kimliği sorgulanır. SMS liste gruplaması tek geçişte yapılır; yeni/bilinmeyen durumlar kaybolmadan kontrol edilecek gruba girer. Gönderim yalnız QUEUED kayıtları için, açık onay ve sunucudaki claim kontrolüyle çalışır.
- Bellek önbelleği süresi dolmuş girişleri temizler ve tamamlanmış girişler için 256 sınırı uygular. Hesap değişimi/yazma/elle yenileme temizliği korunur.
- Yeni kabul formu tüm müşteri tablosunu form açılışında istemez. Tam telefon numarasını 300 ms bekleyerek arar; eski cevaplar yeni yazıyı ezmez. Kaydetme sırasında çift dokunma kilidi kullanılır. Müşteri ve ödeme kaydında da senkron kilit vardır.
- Yumurta adedi pozitif tam sayı, cep telefonu geçerli numara olarak doğrulanır. Daha önce yok sayılan ırk bilgisi mevcut breeds şeması üzerinden kaydedilir; eşzamanlı ırk eklemede unique kuralı korunur.
- Kabul kaydedildikten sonra ödeme başarısız olursa kullanıcıya kısmi başarı açıkça bildirilir; aynı kabulü yeniden eklemesi istenmez. Kabulden SMS merkezine dönüşte kayıt formu gezinme yığınında bırakılmaz. Ödeme kaydedilip ekran yenilemesi başarısız olursa ödeme başarısızmış gibi gösterilmez.
- Parti detayında başarısız/eksik kayıt için sonsuz yükleme yerine hata ve tekrar deneme görünür. Beklenmeyen çizim hatası için uygulama sınırında yeniden deneme ekranı eklendi.
- Release sürümü 1.1.0 / versionCode 2. Android 7+ için ARM 32/64 bit APK, kalıcı özel dağıtım anahtarı, ortama duyarlı build kontrolü ve SHA-256 çıktısı eklendi. Geliştirme imzalı eski telefonlar için ayrı uyumlu güncelleme paketi bulunur.
- Release manifestinden harici depolama ve diğer uygulamaların üzerinde gösterme izinleri çıkarıldı. İnternet, SMS ve mevcut gerekli bağımlılık izinleri korundu. Release HTTP açık metin trafiğini kabul etmez.

## Doğrulama sınırları

TypeScript, yerel mock tabanlı regresyon testleri ve yerel Android release derlemesi kullanılır. Tek bağlı Samsung telefon fiziksel test cihazıdır; diğer marka/Android sürümlerinde gerçek cihaz testi ve gerçek ücretli SMS gönderimi bu temizlik için yapılmaz. SQL güvenlik testleri repoda korunur; bu çalışmada canlı veritabanına migration veya örnek müşteri/ödeme yazılmaz.

Expo uyumluluk kontrolünde gereken yamalar uygulandı: Expo 57.0.31, expo-crypto 57.0.4, expo-dev-client 57.0.20. Uyumlu `npm audit fix` ile uygulama Zod'u 4.6.7'ye ve shell-quote 1.12.0'a geçti; gezinme ağacındaki decode-uri-component bildirimi de giderildi. SDK düşüren `--force` uygulanmadı.

Tarama sıfır açık sonucu vermiyor: Expo CLI'nin node-forge ve Zod 3 bağımlılıkları nedeniyle beş yüksek seviye raporlama girdisi kalıyor. Bunlar derleme/geliştirme aracı zincirindedir; node-forge için bildirilen yamalı sürüm henüz yoktur ([üretici deposunu referanslayan bildirim](https://github.com/advisories/GHSA-86w9-cpqp-85rv)). Uygulamada kullanılan Zod 4 sürümü güncellendi; CLI Zod 3 sürümü büyük sürüm zorlamasıyla değiştirilmedi ([Zod bildirimi](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)). Audit özeti `output/review/dependency-audit.json` dosyasındadır. Mobil çalışma zamanı paketinde bu CLI dosyalarının bulunup bulunmadığı kaynak haritasıyla ayrıca kontrol edilir.

Ağdan gelen kabul isteğinin sunucuda tamamlanıp cevabın bağlantıda kaybolması halinde uçtan uca idempotency garantisi yoktur. Kabul ve ilk ödeme ayrı sunucu işlemleridir; tek transaction değildir. Kesin atomik kayıt için ileride idempotent bir RPC gerekir. Bu çalışma şema değişikliği gerektirmeyen kısmi başarı ve tekrar kayıt riskini azaltan istemci düzeltmelerini uygular.

Büyük listelerin doğruluğu korunmuştur; tamamı belleğe alınan ekranlar çok büyük veri hacminde ayrıca sunucu tarafında sayfalı UI/özet RPC'si gerektirebilir. Bağımsız işletmeler için tenant ayrımı uygulanmaz; mevcut yetki modeli tek işletmenin yetkilendirilmiş kullanıcıları içindir.

## Sonuçlanan kontroller

- `npm run check`: TypeScript (kullanılmayan kod denetimleri dahil) ve 23 regresyon testi başarılı.
- `npx expo install --check`: SDK bağımlılıkları uyumlu.
- Yeni dağıtım ve mevcut telefon için ayrı imzalı iki release APK başarıyla üretildi. Her ikisinin SHA-256 dosya özeti doğrulandı.
- Dağıtım APK'sında versionName 1.1.0, versionCode 2, minSdk 24, ARM armeabi-v7a + arm64-v8a doğrulandı. APK imza kontrolü ve `zipalign -c -P 16 4` başarılı.
- Son npm audit: kritik 0, orta 0, yüksek 5. Kaynak haritasında node-forge ve CLI Zod 3 dosyaları 0; Expo'nun Metro require çalışma zamanı yardımcı dosyası paket içindedir, tüm CLI dosyalarının hariç olduğu iddia edilmez.
- Mevcut Samsung SM-S711B telefona uyumlu güncelleme veri silmeden yüklendi; versionCode 2 / 1.1.0 cihazdan doğrulandı. Oturum korunarak müşteri, yumurta ve SMS ekranları açıldı; yükleme hatası görülmedi. Yeni kabul ve müşteri formları kayıt oluşturmadan kontrol edildi. Çalışma zamanı hata günlüğünde uygulama hatası görülmedi.
- Üretim imzalı yeni kurulum APK'sı ikinci fiziksel telefonda ayrıca denenmedi. Mevcut telefon geliştirme sertifikalı olduğundan aynı içerikli uyumlu paketle test edildi.

Dağıtılacak dosyalar `output/releases` içindedir. Yeni telefonlar için `KuluckaTakip-1.1.0.apk`; eski geliştirme sürümü olan telefonlar için `KuluckaTakip-1.1.0-mevcut-telefon-guncelleme.apk`. Özel anahtarlar paylaşım klasöründe değildir; `.signing` klasörü ve içindeki her iki imza serisi güvenli yedeklenmelidir.
