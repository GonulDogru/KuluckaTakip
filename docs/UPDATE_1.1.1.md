# 1.1.1 — Kısa yumurta kabul formu

- Tek uzun form yerine Müşteri, Yumurta ve Ödeme adımları kullanılır.
- İlerleme göstergesi mevcut adımı belirtir. İlerlerken ilgili alanlar doğrulanır; son kaydetme bütün formu denetler.
- React Hook Form değerleri adım değiştirilince silinmez. Geri dönüşte girilen bilgiler korunur. Her adımın kaydırma konumu sıfırlanır.
- Irk ve not alanları ikinci adımda isteğe bağlı açılır; kapatınca değerler korunur.
- Kabul ve kuluçka tarihleri yan yana, çıkım hesabı kısa bilgi satırında sunulur. Kuluçka tarihi isteğe bağlıdır ve kaldırılabilir.
- Birim fiyat ve ödenen tutar yan yana; toplam/kalan tutar ve son kabul özeti üçüncü adımda bulunur.
- İç içe kart alanlarında klavye kaydırması alanın gerçek konumuna göre ölçülür. Tarih alanlarının yalnız bu formda kullanılan dar görünümü eklenmiştir.
- Kayıt, ödeme ve SMS işlemleri son kaydetme adımında çalışır; adımlar arası geçiş veri yazmaz.

TypeScript ve mevcut 23 regresyon testi geçti. İki imza serisinde 32/64 bit ARM release paketi üretildi; dosya özetleri ve dağıtım imzası doğrulandı. Son sürüm bağlı Samsung telefona yüklendi. Üç adım kayıt oluşturmadan denendi: toplam/kalan tutar hesapları, geri dönüşte müşteri ve yumurta adedinin korunması doğrulandı. Tekrarlanan sayfa başlığı ve üst boşluk kaldırılarak ikinci adımın devam düğmesinin görünmesi sağlandı. Çalışma zamanı hatası görülmedi; deneme bilgileri kaydedilmeden formdan çıkıldı.
