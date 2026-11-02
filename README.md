# Kuluçka Takip

Expo SDK 57, React Native ve Supabase ile Android kuluçka takibi. Müşteri, yumurta kabulü, ödeme ve onaylı SIM SMS gönderimi tek uygulamadadır.

## Yeni telefona kurulum

1. `output/releases/KuluckaTakip-1.1.2.apk` dosyasını Android telefona aktarın ve açın.
2. Telefon isterse dosyayı açan uygulamaya bu kaynaktan kurulum izni verin.
3. İnternet bağlantısıyla yetkili hesabınızla giriş yapın. Diğer telefonlarla aynı işletme kayıtları Supabase üzerinden kullanılır.
4. SMS izni yalnız gerçekten mesaj göndermek istediğinizde istenir. SIM ve varsayılan SMS hattı gerekir; kayıtları görüntülemek için SMS izni gerekmez.

Uygulama bilgisayar, Metro veya Expo Go bağlantısı olmadan çalışır. Sunucu kayıtları için internet gerekir; çevrimdışı kayıt ve senkronizasyon kuyruğu yoktur. Paket Android 7 ve üzeri ARM 32/64 bit telefonlar içindir; iPhone kurulum paketi değildir.

Daha önce geliştirme sürümü yüklenmiş telefonlarda `KuluckaTakip-1.1.2-mevcut-telefon-guncelleme.apk` dosyası kullanılır. Bu paket mevcut imzayı korur. Yeni dağıtım anahtarıyla imzalanan standart APK eski geliştirme imzasının üzerine kurulamaz; mevcut uygulamayı ve verilerini silmeyin. Sonraki güncellemelerde her telefon için aynı imza serisi kullanılmalıdır.

## Hesap ve sunucu

`.env.example` örneğiyle `.env` oluşturun. Yalnız proje URL'si ve **public anon/publishable** anahtar kullanılmalıdır; service-role/secret anahtarlar mobil uygulamaya konmaz.

Migration'ların asıl dizini `supabase/migrations` dizinidir. `database/migrations` mevcut SQL Editor kurulumları için eşlenmiş kopyadır. Migration sırası korunmalıdır; yalnız ilk şemayı uygulamak yeterli değildir. Dağıtım için üyelik, SMS claim/içerik doğrulama, birleşik SMS listesi ve ana sayfa özet fonksiyonlarının da sunucuda bulunması gerekir.

Kullanıcılar Supabase Authentication üzerinden yönetici tarafından oluşturulur; uygulamada herkese açık kayıt yoktur. Yönetici, giriş yapacak kullanıcının Auth UUID'sini `public.app_members` tablosuna `active=true` olarak ekler. Yetkili hesaplar aynı işletme verilerini paylaşır. Çıkış yalnız kullanılan telefonun oturumunu kapatır. Supabase Auth ayarlarında eşzamanlı oturumların kısıtlanmadığı kontrol edilmelidir.

## Geliştirme ve kontroller

Node.js 22.13 veya üstü, Java 17 ve Android SDK gerekir.

```powershell
npm ci
npm run check
npm run start
```

Gerçek SIM gönderimi özel `modules/sim-sms` modülünü içerir; Expo Go ile gerçek SMS testi yapılamaz. Android geliştirme paketi için `npm run android` kullanın. Sunucu ayarları eksikse yalnız geliştirmede demo ekranları açılır; release paketi eksik ayarlarla demo veriye yazmaz.

## Dağıtım paketi üretme

```powershell
npm run build:android
# Eski geliştirme sertifikasıyla kurulmuş telefonları veri silmeden güncellemek için:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-android.ps1 -LegacyUpdate
```

Komut sunucu ayarlarını, TypeScript'i ve testleri kontrol eder; Hermes içeren release APK'sını ARM 32/64 bit için derler. APK ve SHA-256 özeti `output/releases` dizinine yazılır. İlk çalışmada kalıcı dağıtım anahtarı `.signing` dizininde oluşturulur. **Bu dizini özel ve güvenli bir yerde yedekleyin; sonraki sürümleri aynı anahtarla imzalamak gerekir.** Anahtar ve parolalar Git'e veya APK paylaşım klasörüne dahil edilmez.

`app.json`, `package.json` ve `android/app/build.gradle` sürümleri birlikte artırılır; her dağıtımda Android `versionCode` büyütülür. `eas.json` bulut build profilleri ayrıca hesap/kimlik bilgisi kurulumu gerektirir; burada doğrulanan dağıtım yerel PowerShell akışıdır.

## İnceleme

Temizlik, düzeltmeler ve doğrulama kapsamı: [RELEASE_REVIEW.md](docs/RELEASE_REVIEW.md).
