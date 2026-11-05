# 1.1.4 — Redmi SIM SMS desteği

5 Kasım 2026 · versionCode 6 · Android 7+ · ARM 32/64 bit.

Redmi Note 11 Pro (Android 13 / API 33) üzerinde “Doğrudan SIM gönderimi için ExpoSimSms native modülünü içeren bir Android APK gerekir” hatası giderildi. Modül önceki APK'da da mevcuttu; hata, modülün bulunmaması ile telefonun SMS yeteneğinin aynı boolean üzerinden değerlendirilmesinden kaynaklanıyordu.

Bu Redmi'nin özellik listesinde `android.hardware.telephony` ve GSM bulunurken yeni `android.hardware.telephony.messaging` bayrağı bulunmuyor. Native kontrol artık yeni bayrağın yanında eski telefon özelliğini ve `TelephonyManager.isSmsCapable` sonucunu da değerlendirir. Böylece yalnız veri bağlantısını destekleyen modemler SMS destekli kabul edilmez. Aynı kontrol gönderim öncesinde de kullanılır.

Eksik modül, SMS donanımı bulunmaması ve geçici kontrol hataları artık ayrı açıklanır. SMS Merkezi'nin üstünde telefon desteği bilgisi gösterilir. Bu bilgi, SIM'in aktif olduğunu veya SMS'in teslim edileceğini garanti etmez; gönderim yine kullanıcı onayı, Android izni, varsayılan SIM ve sunucu claim kontrolünü gerektirir.

Referans: [Android TelephonyManager.isSmsCapable](https://developer.android.com/reference/android/telephony/TelephonyManager#isSmsCapable()).

## Kontroller ve dağıtım

- TypeScript ve 39 regresyon testi başarılı. Yeni testler modül/donanım ayrımını, izin isteme akışını, izin reddinde gönderim yapılmamasını ve onaylanan içerik değişirse işlemin durmasını kapsar.
- Android release derlemesi başarılı; standart ve eski telefon imzası için iki APK üretildi. Önceki sürümle imza eşleşmesi, 16 KB hizalama ve SHA-256 kontrolleri geçti.
- Bağlı Redmi'ye standart imzalı 1.1.4, uygulama kaldırılmadan yüklendi. Cihazdan versionName 1.1.4 / versionCode 6 doğrulandı.
- Kullanıcının açtığı SMS Merkezi ekranından “Bu telefonun SIM üzerinden SMS desteği algılandı.” mesajı doğrulandı. Bu kontrol gerçek uygulamanın native `isAvailable` sonucunu kullanır; önceki yanlış modül/donanım hatası bu cihazda giderildi.
- Gerçek SMS gönderimi yapılmadı; müşteri mesajları ve gönderim onayları otomatik tetiklenmedi.

Bu sürüm için yeni sunucu migration'ı gerekmez. 1.1.3 için uygulanan sunucu güncellemeleri kullanılmaya devam eder.
