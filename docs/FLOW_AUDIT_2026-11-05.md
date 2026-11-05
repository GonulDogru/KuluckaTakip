# Kuluçka Takip akış incelemesi

Tarih: 5 Kasım 2026. İncelenen kaynak sürümü: package.json 1.1.2.

## Kapsam ve doğrulama

Müşteri oluşturma/düzenleme/arşivleme, yumurta kabulü/düzenleme, ödeme, borç özetleri, SMS taslağı/kuyruk/SIM gönderimi, gezinme ve Supabase migration kaynakları incelendi. Expo 57 sürüm belgeleri okundu: https://docs.expo.dev/versions/v57.0.0/.

- `npm.cmd run check`: TypeScript ve 24 regresyon testi başarılı.
- `node --env-file=.env scripts/check-release-env.cjs`: başarılı. Bu kontrol anahtarın biçimini doğrular; canlı yetkiyi doğrulamaz.
- Yapılandırılmış Supabase `/auth/v1/settings`: HTTP 200. Sunucuya ağ erişimi var.
- Oturumsuz `/rest/v1/`: HTTP 401. Bu sonuç tek başına uygulama bağlantısının bozuk olduğunu göstermez; yetkili oturumla tablo/RPC erişimi doğrulanmadı.
- Fiziksel cihaz doğrulaması yapılamadı: bu ortamda ADB daemon başlatılamadı.
- Canlı veriye yazılmadı, migration uygulanmadı, ödeme eklenmedi, SMS gönderilmedi. Mevcut testlerin geçmesi aşağıdaki uçtan uca akışların doğrulandığı anlamına gelmez.
- Başlangıçta `supabase/.temp/cli-latest` dosyası değişmiş durumdaydı; dokunulmadı.

## Yüksek öncelikli bulgular

### 1. Kuluçka tarihi temizlendiğinde eski çıkım tarihi kalıyor

Kaynak: `supabase/migrations/20260914215000_initial_schema.sql:104`, `src/services/batchService.ts:134`.

`calculate_batch_dates` yalnızca `incubation_date` doluyken tarihleri hesaplıyor; boşaldığında `transfer_date` ve `expected_hatch_date` alanlarını NULL yapan dal yok. Sonraki migration'larda fonksiyon değiştirilmemiş. İstemci güncellemesi de bu alanları göndermiyor. Sonuç: tarih kaldırılırsa eski çıkım tarihi kayıt ve SMS üzerinde yaşamaya devam edebilir. Demo davranışı bu alanları temizlediğinden gerçek veritabanıyla farklıdır.

Öneri: trigger içinde tarih kaldırılmasını ele al; bekleyen SMS'i aynı işlemde geçersiz kıl veya yeniden onaya çıkar.

### 2. Sonradan kuluçka tarihi eklenmesi parti durumunu değiştirmiyor

Kaynak: `src/screens/BatchDetailScreen.tsx:128`, `src/services/batchService.ts:134`.

Tarihsiz oluşturulan kabul `RECEIVED` olur. Detaydan tarih eklenirken `status` gönderilmiyor, veritabanı tarih trigger'ı da durumu değiştirmiyor. Parti tarihli olduğu halde “Kabul edildi” olarak kalır. Tarih kaldırıldığında ters yönde tutarsızlık da oluşabilir. Durum filtreleri ve duruma bağlı operasyonlar etkilenir.

Öneri: izin verilen durum geçişlerini sunucuda tanımla; tarih değişikliklerinin başlangıç durumlarıyla ilişkisini açıkça uygula.

### 3. Müşteri telefonu değişince SMS eski numaraya bağlı kalıyor

Kaynak: `src/services/customerService.ts:140`, `src/services/smsService.ts:98`, `src/services/smsService.ts:334`.

Müşteri düzenlemesi yalnızca müşteri tablosunu güncelliyor. Mevcut SMS'in `phone` ve kişiye hitap eden mesajı eşitlenmiyor. Gönderimde kontrol edilen numara SMS kaydındaki numara; güncel müşteri numarasıyla karşılaştırılmıyor. Kullanıcı onayı var, ancak eski numara artık başka kişiye ait olabilir.

Öneri: gönderilmemiş taslakları müşteri değişiminde güncelle ve yeniden onaya çıkar; gönderilen mesajların geçmişini koru.

### 4. Kabul ve ödeme tekrar denemelerinde çift kayıt riski var

Kaynak: `src/screens/NewBatchScreen.tsx:170`, `src/screens/NewBatchScreen.tsx:184`, `src/screens/BatchDetailScreen.tsx:87`.

Kabul, ilk ödeme ve SMS ayrı istekler. Kabul başarılı olup ödeme açıkça hata döndürürse kullanıcıya kısmi başarı bildiriliyor; bu olumlu. Ancak sunucu işlemi tamamlayıp cevap ağda kaybolursa istemci başarısızlık görebilir. Kalıcı işlem kimliği/idempotency yok; tekrar denemek ikinci kabul veya ödeme oluşturabilir. Ekrandaki ref kilitleri yalnız aynı açık ekrandaki eşzamanlı dokunuşu önler.

Öneri: kabul ve ilk ödeme için transaction içeren idempotent RPC; sonradan eklenen ödemeler için de benzersiz işlem kimliği.

## Orta öncelikli bulgular ve eksikler

### 5. İşletme sürecinin devamı arayüzde bağlı değil

Kaynak: `src/navigation/AppNavigator.tsx`, `src/navigation/types.ts`.

Makine, raf, yerleşim ve çıkım sepeti ekranları/servisleri mevcut; aktif navigator yalnız ana sekmeler, müşteri, kabul ve SMS ekranlarını kaydediyor. Makine/raf/sepet ekranlarına normal uygulama menüsünden ulaşılamıyor. Çıkım sonucu, teslim ve iptal için aktif ekranlarda işlem bulunmuyor. `HATCHED`, `DELIVERED`, `CANCELLED` filtreleri mevcut olsa da kullanıcı bu durumlara geçiremiyor. Bu alanlar daha önceki release notlarında gelecekteki işlevler olarak belirtilmiş; mevcut ürün kapsamının sınırı.

### 6. SMS taslağı oluşturulamazsa doğrudan yeniden oluşturma yolu yok

Kaynak: `src/screens/NewBatchScreen.tsx:201`, `src/screens/BatchDetailScreen.tsx`, `src/services/smsService.ts:189`.

İlk kayıtta SMS isteği başarısız olursa kabul korunuyor ve uyarı gösteriliyor. Ancak kabul detayında “SMS taslağı oluştur/yeniden dene” işlemi yok. SMS Merkezi yalnız mevcut logları listeliyor. Kullanıcı kabulü yeniden düzenleyip kaydederek dolaylı şekilde taslak oluşturabiliyor; bu kurtarma yolu görünür değil.

### 7. Yalnız not değişse bile özel SMS metni ezilebilir

Kaynak: `src/screens/BatchDetailScreen.tsx:128`, `src/services/batchService.ts:135`, `supabase/migrations/20261009160000_authorized_users_multidevice_sms.sql:136`.

Detay ekranı her kayıtta tür/adet/tarih alanlarını gönderiyor. Servis değer değişikliğini değil alanın gönderilmesini denetleyerek SMS eşitlemesini başlatıyor. Sonuç: yalnız not düzenlenmiş olsa bile elle yazılmış PENDING/QUEUED/FAILED mesaj standart şablonla değiştirilir. UNKNOWN/SENDING durumda RPC eşitlemeyi reddeder; kabul güncellenmiş olmasına rağmen ekran “Düzenleme kaydedilemedi” başlığı gösterebilir.

### 8. SMS Merkezi ve detaylar arka plandan dönüşte yenilenmiyor

Kaynak: `src/screens/SmsCenterScreen.tsx:35`, `src/screens/BatchDetailScreen.tsx:60`, `src/screens/CustomerDetailScreen.tsx:46`.

Bu ekranlar yalnız navigation focus ile okuyor. Müşteri/yumurta ana listelerinde kullanılan foreground yenileme hook'u burada yok. Aynı ekran açıkken başka telefonun yaptığı işlem veya süresi dolan SMS claim'i görünmeyebilir. SMS Merkezi'nde çekerek yenileme/yeniden dene düğmesi de yok. Gönderimde sunucu claim kontrolü çift gönderime karşı ek koruma sağlar; liste yine de eski kalabilir.

### 9. Ödeme düzeltme ve fazla ödeme akışı eksik

Kaynak: `src/screens/BatchDetailScreen.tsx`, `src/services/paymentService.ts`, `supabase/migrations/20260914215000_initial_schema.sql:151`.

Pozitif ödeme eklenebiliyor; ancak hatalı ödemenin düzenlenmesi/iptali/iadesi için ekran yok. Kalan borcu aşan ödeme uyarısız kabul ediliyor ve negatif borç gösteriliyor. Fazla ödeme iş kuralıyla yasaklanmış değil; avans/alacak olarak desteklenecekse arayüzde açıkça ayrılmalı. Ayrıca veritabanında payment.customer_id ile batch.customer_id eşleşmesini zorlayan birleşik ilişki/trigger yok. Mevcut ekran doğru kimlikleri gönderiyor; veri bütünlüğü sunucuda garanti edilmiyor.

### 10. Tür değişiminde eski ırk ilişkisi korunuyor

Kaynak: `src/screens/BatchDetailScreen.tsx:128`, `supabase/migrations/20260914215000_initial_schema.sql:68`.

Tür düzenlenebiliyor fakat `breed_id` temizlenmiyor veya yeniden seçilmiyor. Veritabanı yalnız ırkın varlığını denetliyor, seçili türe ait olmasını değil. Böylece yeni yumurta türü eski türün ırkına bağlı kalabilir. Irk ilk kabulde kaydedilse de mevcut detayda görüntülenmiyor/düzenlenmiyor.

### 11. Arşivlenen müşteri yeniden kabulde gizli kalabilir

Kaynak: `src/services/customerService.ts:78`, `src/screens/NewBatchScreen.tsx:156`.

Telefon araması arşivlenmiş müşterileri de buluyor. Yeni kabul bu müşteriyi uyarısız kullanıyor; aktif hale getirmiyor. Kabul yumurta listesinde görünürken müşteri aktif müşteri listesinde görünmez. Arşivden geri alma için görünür bir işlem de yok. Borç varken arşivlemeye engel/uyarı bulunmuyor.

### 12. Ördek tarihi migration'ı mevcut SMS'leri güncellemiyor

Kaynak: `supabase/migrations/20261025210000_recalculate_pending_duck_hatch_dates.sql`.

Migration aktif ördek partilerinin çıkım tarihini tekrar hesaplatıyor; SMS metinlerini değiştirmiyor. Daha önce hazırlanmış mesaj eski tarihi taşıyabilir. Bu migration canlıda uygulanmışsa mevcut ördek SMS'lerinin ayrıca kontrol edilmesi gerekir; canlı kayıtlar bu incelemede doğrulanmadı.

## SMS sisteminin mevcut çalışma şekli

Akış: kabul → tarih varsa PENDING taslak → önizleme/düzenleme → QUEUED → açık kullanıcı onayı → Android SEND_SMS izni → sunucuda atomik claim ve onaylanan içerik kontrolü → özel native modülle varsayılan SIM üzerinden gönderim → SENT/FAILED/UNKNOWN.

İki cihazın aynı SMS'i sahiplenmesini önleyen claim, lease yenilemesi ve belirsiz sonuçta otomatik tekrar yapmama mekanizmaları mevcut. Tekrar gönderim açık risk onayıyla kuyruğa dönüyor. SENT, Android gönderim sonucudur; müşteriye teslim teyidi değildir. Operatör/harici SMS API entegrasyonu yok; bu bir telefon SIM gönderim sistemidir. Tahmini çıkım mesajı var; ödeme makbuzu, borç hatırlatma veya gerçek çıkım/teslim mesajı akışı bulunmuyor.

## Önerilen sıra

1. Tarih temizleme ve başlangıç durum geçişleri; bunlara yönelik veritabanı ve servis regresyon testleri.
2. Müşteri/SMS tutarlılığı, özel mesaj koruması ve taslak kurtarma işlemi.
3. İdempotent kabul/ödeme RPC'leri ve müşteri-parti ödeme bütünlüğü.
4. Ödeme düzeltme, fazla ödeme/avans kararı, arşivden dönüş ve tür-ırk tutarlılığı.
5. SMS/detay foreground yenilemesi; kapsam isteniyorsa çıkım/teslim ekranlarının bağlanması.
6. Yetkili test hesabı ve fiziksel Android cihazla kayıt, kesilen bağlantı, ödeme, iki cihaz yarışı ve gerçek SIM gönderimi doğrulaması.

Bu incelemede uygulama kodu değiştirilmedi; bulgular kaynak analizi ve yukarıda belirtilen kontrollerle sınırlıdır.
