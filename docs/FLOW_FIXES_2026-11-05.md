# Kayıt, ödeme ve SMS akış düzeltmeleri

5 Kasım 2026. Makine/raf/çıkım/teslim/iptal ekranlarının bağlanması kapsam dışında tutuldu.

## Değişiklikler

- Kabul, müşteri/ırk oluşturma, ilk ödeme ve ilk SMS taslağı `save_acceptance` RPC'sinde tek transaction içinde kaydedilir. İşlemin bir adımı başarısızsa tamamı geri alınır. Tarihsiz kabulde SMS, tarih sonradan eklendiğinde oluşturulur.
- Kabul ve ödeme isteklerinin kimliği gönderimden önce cihazda, kullanıcı hesabına göre ayrı saklanır. Belirsiz ağ sonucunda aynı kimlik ve bilgiler kullanılır; sunucu ikinci kayıt oluşturmaz. Uygulama yeniden açıldığında kabul formu veya kabul detayındaki bekleyen ödeme işlemi geri yüklenir. Sonucu belirsiz işlem farklı bilgilerle değiştirilemez. Kesin veritabanı reddinde işlem geri alındığından bilgiler düzeltilebilir.
- Kuluçka tarihi kaldırılırsa çıkım/aktarım tarihleri temizlenir. Başlangıç durumları tarih ile eşitlenir; yalnız not değiştirmek mevcut aktarım durumunu bozmaz. Kabulden önce kuluçka tarihi girilmesi yeni/değişen tarihler için engellenir; tarih kaldırma düğmesi detay ekranında bulunur.
- Müşteri adı/telefonu ve kabul bilgileri değişince düzenlenebilir SMS'ler sunucuda eşitlenir. Kuyruktaki mesaj tekrar taslak olur. Elle yazılmış metin korunur; kullanıcı yeni bilgileri kontrol edip yeniden kuyruğa alır. Gönderim claim'i güncel müşteri telefonu, aktif müşteri, geçerli çıkım tarihi ve onaylanan içerik ile karşılaştırılır. Gönderilmiş ve fiziksel sonucu belirsiz mesajların geçmişi değiştirilmez.
- SMS oluşturma başarısızlığını gidermek için kabul detayında “SMS taslağını aç / oluştur” işlemi bulunur. Mevcut mesaj tekrar oluşturulmaz. Belirsiz/başarısız gönderimin açık onayla tekrar denenmesi güncel alıcıyla PENDING durumuna döner; kuyruğa ekleme ve SIM gönderimi ayrıca onaylanır.
- Ödeme düzeltme ve gerekçeli iptal arayüzü eklendi. İptal edilen ödeme silinmez, borç hesabından çıkarılır. Ekleme/düzeltme/iptal işlemleri sunucuda kullanıcı ve önceki/sonraki değerleriyle özel denetim tablosuna yazılır. Başka cihazın değiştirdiği ödeme eski bilgilerle ezilemez. Bu bir muhasebe düzeltmesidir; fiziksel para iadesi veya banka işlemi yapmaz.
- Yeni/fazladan ödeme kalan borcu aşamaz. Eski fazla ödemeler silinmez; detaylarda müşteri alacağı olarak gösterilir. Ödeme-kabul müşteri eşleşmesi sunucuda doğrulanır. Doğrudan ödeme tablosuna istemci yazımı kapatılmıştır.
- Tür değiştiğinde eski türe ait ırk temizlenir. Detayda ırk görüntüleme ve düzenleme eklendi; sunucu tür-ırk eşleşmesini doğrular.
- Müşteri listesinde arşivdeki müşterileri gösterme, detayda arşivden çıkarma ve borçlu müşteriyi arşivlemeden önce uyarı eklendi. Arşivlenmiş müşteriye yeni kabul açılması engellenir.
- SMS Merkezi, SMS önizleme ve müşteri/kabul detayları uygulamaya dönüşte yenilenir. SMS Merkezi'nde çekerek yenileme ve hata sonrası tekrar deneme bulunur.
- Migration, mevcut türetilmiş tarihleri ve düzenlenebilir otomatik SMS şablonlarını da düzeltir. Önceden yanlış tarih taşıyan ördek mesajları yeniden hazırlanıp kontrol için taslaklara döner. Özel mesajlar ve gönderim geçmişi korunur.

## Sunucuya geçiş

Yeni istemci **önce sunucunun güncellenmesini gerektirir**:

1. Veritabanının yedeğini alın ve tüm telefonlar için güncellemeyi birlikte planlayın.
2. Önceki migration'lar uygulanmış sunucuda sırasıyla `supabase/migrations/20261105120000_flow_integrity.sql` ve `20261105130000_sms_signature.sql` dosyalarını uygulayın. SQL Editor için aynı içerikler `database/migrations` altında bulunur. İki dizindeki kopyaları aynı veritabanında ayrı ayrı çalıştırmayın. Dosyalar transaction içerir; hata halinde işlem geri alınır.
3. Ardından yeni kaynakla üretilen Android uygulamasını dağıtın. Eski istemci doğrudan ödeme ve SMS taslağı yazdığı için migration sonrasında bu işlemler eski sürümde yetki hatası verir. Bütün telefonlar yeni istemciye geçirilmelidir.
4. Bir test hesabıyla kabul/ilk ödeme, SMS önizleme, müşteri telefonu değişimi, ödeme düzeltme/iptal ve iki cihazdan yenileme akışlarını doğrulayın.

APK hazırlığı sırasında bağlı Supabase hesabının yetkisiyle iki migration canlı sunucuya uygulandı ve 1.1.3 APK’ları üretildi. Güncelleme öncesi müşteri, kabul, ödeme, SMS, tür/ırk kayıtları ve fonksiyon tanımları özel `output/review/pre-1.1.3-data.json` dosyasına yedeklendi. Bu, tüm veritabanının pg_dump yedeği değildir; Docker çalışmadığından tam şema dump’ı alınamadı. Fiziksel cihazda gerçek SIM gönderimi yapılmadı.

## Kontroller

- `npm.cmd run check`: TypeScript ve 31 regresyon testi başarılı. Yeni testler yanıt kaybı, uygulama yeniden açılması, farklı bilgilerle tekrar deneme, hesap ayrımı, saklama hatası ve eşzamanlı işlem kilidini kapsar.
- Expo Android/Hermes üretim bundle dışa aktarımı başarılı; çıktı `output/review/flow-bundle` altında. Bu çıktı yüklenebilir APK değildir.
- Yerel PostgreSQL 16'da önceki migration'lar ve yeni migration uygulandı. `supabase/tests/flow_integrity.test.sql` içindeki 44 doğrulama başarılı. Kayıt/ödeme atomikliği, idempotency, müşteri-ödeme ilişkisi, tarih/durum/ırk tutarlılığı, SMS içerik/claim/lease/sonuç protokolü, özel metin ve gönderim geçmişi, ödeme denetimi ve yetki kontrolleri doğrulandı.
- Eski şemaya örnek kayıtlar eklenip yeni migration uygulandığında mevcut ördek SMS tarihi, kaldırılmış kuluçka tarihinden kalan alanlar ve özel metin koruması için üç ek yükseltme kontrolü başarılı.
- pgTAP tabanlı eski SMS testinin örnekleri, yeni müşteri/kabul koşuluna ve yeniden kontrol adımına uyarlandı. Bu ortamda pgTAP kurulu olmadığı için pgTAP testleri çalıştırılmadı; yukarıdaki bağımsız SQL testleri çalıştırıldı.

Yerel SQL kontrolü için tüm migration'lar uygulanmış test veritabanında:

```powershell
psql -v ON_ERROR_STOP=1 -f supabase/tests/flow_integrity.test.sql
```

Test kendi örnek verilerini transaction sonunda geri alır. `scripts/flow-test-bootstrap.sql`, Supabase olmadan geçici PostgreSQL kurulumunda yalnız test için Auth/RLS rollerini taklit eder; canlı Supabase üzerinde çalıştırılmaz.

## Telefon alanı ve SMS imzası

Telefon alanına odaklanma klavye açılmadan önce geldiği için ilk kaydırma, yeterli kaydırma alanı oluşmadan tamamlanabiliyordu. Ortak form bileşeni artık odaklanan alanı saklar; klavye açıldığında, içerik boyutu veya görünür alan değiştiğinde yeniden ölçer. Alanın alt kenarı, klavye ve görünür alanın üstünde 16 piksel boşlukla tutulur. Odak değişimi/çıkışı da izlenir.

SMS şablonu ve düzenlenmiş mesajlar son satırda `Yalınayak Süs Tavukları 🐔` imzası taşır. İmza yeniden kaydetmelerde çoğalmaz. `20261105130000_sms_signature.sql` sunucu şablonunu ve düzenleme/kuyruk işlemlerini günceller; gönderilmemiş eski mesajlara da imzayı ekler. Değişen kuyruk mesajları yeniden kontrol için taslağa döner. Gönderilmiş, gönderimi devam eden ve sonucu belirsiz mesajların geçmişi değiştirilmez.

Güncel kontroller: TypeScript ve 34 uygulama testi; yerel PostgreSQL'de 44 akış, 6 imza ve 2 imza geçiş kontrolü başarılı. Klavye için alan geometrisi ve klavye açılmasından sonra yeniden kaydırma davranışı test edildi. Fiziksel telefonda görsel doğrulama yapılmadı.
