# Database

İlk şema `database/migrations/20260914215000_initial_schema.sql` içindedir.

## Tablolar

- `profiles`
- `customers`
- `egg_types`
- `breeds`
- `machines`
- `racks`
- `batches`
- `placements`
- `hatch_baskets`
- `hatch_basket_placements`
- `payments`
- `hatch_results`
- `sms_logs`
- `sms_sender_devices`

## Önemli Kurallar

`customers.phone_normalized` alanı unique constraint taşır. Türkiye telefonları uygulama tarafında `+90XXXXXXXXXX` formatına normalize edilir.

Müşteriler `is_active` alanıyla arşivlenir. Normal müşteri listesi yalnızca aktif kayıtları getirir; arşivleme müşteriyi veya ilişkili parti/ödeme geçmişini silmez. Arşiv alanı `20261005150000_customer_archiving.sql` migration'ında eklenmiştir.

`batches.batch_no` boş gönderildiğinde migration trigger'ı `P-YYYY-0001` formatında üretir.

`batches.transfer_date` ve `batches.expected_hatch_date`, `egg_types.transfer_day` ve `egg_types.incubation_days` değerlerinden hesaplanır.

Kalan borç kolon olarak tutulmaz. `batch_payment_summaries` view veya uygulama servisleri `total_price - sum(payments.amount)` hesabını kullanır.

## Raf Yerleşimi

Raf ile parti birebir ilişkilendirilmez. Hangi hücrenin hangi partiye ait olduğu `placement_cells` tablosunda tutulur.

`placement_cells` üzerinde `unique (rack_id, row_number, position_number)` constraint vardır. Bu sayede iki cihaz aynı hücreye aynı anda yerleştirme yapmaya çalışsa bile PostgreSQL duplicate hücreye izin vermez.

`validate_placement_cell_bounds` trigger'ı hücrenin raf sınırları içinde kaldığını ve makine/raf eşleşmesinin doğru olduğunu kontrol eder.

## Çıkım Sepeti Aktarımı

`transfer_batch_to_hatch_basket` RPC fonksiyonu sepet kapasitesini kontrol eder, `hatch_basket_placements` kaydı oluşturur, ilgili `placement_cells` kayıtlarını siler ve partiyi `HATCHING` durumuna alır.

## Yumurta Türleri

`egg_types` tablosunda tür adı, kuluçka süresi (`incubation_days`) ve aktiflik (`active`) tutulur. Uygulama aktif türleri Supabase'den listeler. `20261005170000_seed_egg_types.sql` migration'ı istenen altı türü ad üzerinden idempotent şekilde ekler/günceller ve aktif eder; diğer mevcut kayıtları veya eşleşen kayıtların `transfer_day` değerlerini değiştirmez.

- Tavuk: 21 gün
- Hindi: 28 gün
- Bıldırcın: 18 gün
- Kaz: 30 gün
- Ördek: 30 gün
- Keklik: 25 gün

## SMS Taslakları

SMS Merkezi mevcut `sms_logs` tablosunu kullanır. Yeni yumurta kabulinde geçerli müşteri telefonu ve tahmini çıkım tarihi varsa `customer_id`, `batch_id`, `phone`, `message` ve `PENDING` durumu ile yeni bir kayıt eklenir. Aynı `batch_id` ile tekrar eşitleme mevcut SMS kaydını kullanır; düzenlenebilir mesaj müşteri, telefon, yumurta türü, adet ve tahmini çıkım tarihine göre güncellenir. Önizlemede metin aynı kaydın `message` alanına kaydedilir; gönderilecekler listesine ekleme mevcut kaydı `QUEUED` olarak işaretler ve tekrar eklenmesi yeni kayıt oluşturmaz. `QUEUED` SMS gönderilmiş anlamına gelmez. Gerçek SIM gönderimi yalnızca SMS Merkezi'nde kullanıcı onayıyla başlatılır.

### Yetkili kullanıcı erişimi

`20261009160000_authorized_users_multidevice_sms.sql` bütün ortak işletme tablolarını RLS arkasına alır. Uygulama kullanıcıları Supabase Auth ile giriş yapar; `public.app_members` içinde `active = true` kaydı olmayan bir hesap müşteri, parti, ödeme veya SMS verilerine erişemez. Onaylı kullanıcılar aynı işletme verilerini paylaşır. Bu tek işletme için ortak erişim modelidir; kullanıcılar arasında veri bölümlendirmesi yapmaz.

Bu migration **canlı veritabanına kendiliğinden uygulanmaz**. Uygulamadan önce Dashboard/Migration geçmişiyle canlı şemanın beklenen önceki tabloları, kolonları ve fonksiyonları içerdiği doğrulanmalı; migration'lar eksikse önce doğru sırada uygulanmalı. Kod deposundaki bir migration dosyası canlıda çalıştırıldığının kanıtı değildir.

Auth ayarlarında kendi kendine kayıt (Signups) kapalı tutulmalıdır. İşletme yöneticisi Supabase Dashboard'da Auth kullanıcısını oluşturur, ardından SQL Editor'da bu kullanıcının Auth UUID'sini etkinleştirir:

```sql
insert into public.app_members (user_id, active)
values ('<auth-user-uuid>', true)
on conflict (user_id) do update set active = true;
```

Erişimi geri almak için yönetici `public.app_members.active` değerini `false` yapar. Uygulama; `service_role` veya başka bir yönetici anahtarı içermez, yalnızca istemci için tasarlanmış Supabase anon/publishable anahtarı ve giriş yapan kullanıcının Auth oturumunu kullanır. Anon anahtar tek başına erişim yetkisi vermez; yetkiyi RLS ve etkin üyelik belirler. Yeni iş tabloları eklendiğinde aynı RLS/grant modeline alınmadan istemciye açılmamalıdır.

### Çoklu cihaz SMS kaydı ve kuyruğu

`20261006160000_sms_claim_lease.sql` var olan `sms_logs` tablosuna `claimed_by`, `claim_token` ve `lease_until` alanlarını eklemiş ve `sms_sender_devices` tablosunu oluşturmuştur. `20261016170000_sms_confirmed_content_claim.sql`, SMS gönderim yetkisini ayrıca cihaz kaydına bağlamaz; claim/renew/release/mark RPC'leri yalnızca `20261009160000_authorized_users_multidevice_sms.sql` içindeki etkin `app_members` üyeliğine dayanır. Eski `sms_sender_devices` tablosu ve ilgili kolonlar şema uyumluluğu için kalır; SMS gönderim izni için kayıt veya `is_primary` seçimi gerekmez. Her yetkili kullanıcıdan birden fazla Android telefon SMS gönderebilir; her gönderim yine aynı SMS için atomik claim token almalıdır.

`claim_sms_for_send`, SMS Merkezi'nde kullanıcının gördüğü telefon ve mesajın anlık görüntüsünü beklenen içerikle SQL update koşulunda karşılaştırırken kaydı atomik olarak `QUEUED` durumundan `SENDING` durumuna geçirir; içerik değişmişse kayıt claim edilmez. Yalnızca etkin `app_members` üyesi bu RPC'yi kullanabilir; cihaz kaydı veya tek bir ana telefon şartı yoktur. Güvenlik geçişi olarak `20261016170000_sms_confirmed_content_claim.sql`, eski `claim_sms(uuid, uuid, text)` RPC'sinin `PUBLIC`, `anon` ve `authenticated` EXECUTE izinlerini kaldırır; istemci fallback'i yoktur. Migration sırası `20261006160000_sms_claim_lease.sql`, `20261009160000_authorized_users_multidevice_sms.sql`, ardından `20261016170000_sms_confirmed_content_claim.sql` olmalıdır; ikinci migration eski RPC iznini verdiğinden güvenlik migration'ı ondan sonra uygulanmalıdır. Migration'dan sonra eski sürüm istemciler eski RPC üzerinden claim/gönderim yapamaz; yeni istemci `claim_sms_for_send` kullanmalıdır. Aynı anda yalnızca tek telefon claim token alabilir. Gönderim öncesi istemci Türk cep telefonu numarasını doğrular ve normalize eder; Android native modülü de yalnızca `+90` Türkiye cep telefonu biçimini kabul eder. Lease iki dakikadır ve etkin gönderim sırasında istemci 35 saniyede bir `renew_sms_claim` ile yeniler. Etkin uygulama üyeliği, lease zamanı ve token; claim yenileme, bırakma ve sonuç RPC'lerinde doğrulanır. Lease süresi dolan `SENDING` kayıtları `expire_sms_claims` ile `UNKNOWN` olur; hiçbir zaman otomatik `QUEUED` durumuna dönmez. `mark_sms_failed` kesin başarısız geri bildirimi `FAILED`, sonucu kesinleştirilemeyen gönderim `UNKNOWN` olarak saklar. Migration SMS kayıtlarını güncellemez veya silmez.

`UNKNOWN` kayıt SMS Merkezi'nde iki elle uzlaştırma seçeneği sunar: gönderildi olarak işaretlemek veya çift SMS olasılığını kabul ederek yeniden kuyruğa almak. `FAILED` kaydı da kullanıcı eylemiyle tekrar kuyruğa alınabilir. Yeniden kuyruklama gerçek gönderim yapmaz; SIM gönderimi için ayrıca açık onay gerekir. `QUEUED` yalnızca gönderim sırasına alınmış demektir, SMS'in fiziksel olarak gönderildiğini **göstermez**.

`supabase/tests/sms_multidevice_security.test.sql` pgTAP kapsamı; eski RPC'nin `PUBLIC`/`anon`/`authenticated` izinlerinin kapalı olmasını, yeni RPC'nin üyelik ve onaylı içerik kontrolünü, alıcı/mesaj eşleşmemesini, kaydı yapılmamış birden fazla telefondan claim yapılabilmesini, SMS kayıtlarının korunmasını, lease yenilemeyi/süresini aşmayı, eski token'ı ve gönderim/başarısız/manuel retry durumlarını denetler. Canlı veritabanına bağlanmadan yerel Supabase veritabanında `supabase test db` ile çalıştırılmalıdır.

### Android SIM gönderimi

`expo-sms`, Android'de SMS uygulamasını kullanıcıya hazır içerikle açar; arka planda SIM'e doğrudan gönderim yapmaz. Bu nedenle gerçek SIM gönderimi, Expo SDK 57 Expo Modules API kullanan yerel `modules/sim-sms` Android modülünde `SmsManager` üzerinden gerçekleştirilir. Bu özellik Expo Go'da bulunmaz; native modülü içeren Development Build veya release APK gerekir. `app.json` Android `SEND_SMS` iznini tanımlar, uygulama izin istemini gönderim onayı sonrasında gösterir. İzin reddedilirse SMS kuyruğu claim edilmez.

SDK 57 uyumlu `expo-dev-client` bağımlılığı ve `eas.json` geliştirme profili hazırdır. Yerel Android SDK kurulu makinede `npx expo run:android` ilk native Android projesini üretip derler; EAS Build hesabı kullanıldığında kurum içi Development Build için `npx eas-cli build --profile development --platform android` çalıştırılabilir. Expo Go veya yalnızca Metro JavaScript bundle'ı bu modülü içermez.

Her telefonda kullanıcı SMS Merkezi'nde **SIM ile gönder** eylemini ayrıca onaylamalıdır. SMS, cihazın Android'de seçili varsayılan SMS aboneliği/SIM'i üzerinden gönderilir; çift SIM cihazda varsayılan SMS SIM'i Android ayarlarından seçilmelidir. SMS kuyruğunu arka planda otomatik tarama veya otomatik gönderme yoktur. Android'in `SmsManager` gönderim callback'i operatöre teslimatı doğrulamaz; başarılı callback yalnızca Android gönderim isteğinin kabul edildiğini bildirir. Donanım/SIM yokluğu, radyo kapalı olması, callback zaman aşımı ve parçalı mesaj sonuçları arayüzde başarısız ya da belirsiz olarak gösterilir.

SIM'e fiziksel gönderim ile Supabase durum güncellemesi tek atomik işlem değildir. Telefon mesajı gönderip kapanırsa veya ağ/server sonucu kaydedemezse veritabanında sonuç `UNKNOWN` kalabilir. Güvenilir “tam bir kez” gönderim garantisi verilemez; belirsiz sonuç otomatik yeniden denenmez. Kullanıcı SMS Merkezi'nde manuel uzlaştırmalıdır. Manuel yeniden kuyruğa alma çift gönderim riski uyarısıyla ayrıca onaylanır.

`SEND_SMS`, Android'in hassas/kısıtlı izinlerindendir. Bu yapılandırma kurum içi/özel dağıtım ve uygulama üyeliği etkin kullanıcılar içindir; Play Store yayını ayrıca Google Play SMS izin politikası ve gerekli onay/istisna koşullarına bağlıdır. Play dağıtımı varsayılmamalı; özel build'i test etmeden müşteri verisiyle veya gerçek alıcılara gönderim yapılmamalıdır.
