# Business Rules

## Telefon

Türkiye telefonları `normalizeTurkishPhone` ile normalize edilir. Aşağıdaki örnekler aynı kayıt kabul edilir:

- `0532 123 45 67`
- `+90 532 123 45 67`
- `5321234567`

## Kuluçka Tarihleri

Kuluçkaya giriş tarihi girildiğinde:

- `transfer_date = incubation_date + transfer_day`
- `expected_hatch_date = incubation_date + incubation_days`

Tarih hesapları gün bazlı UTC date-only mantığıyla yapılır.

Tavuk örneği:

- Kuluçkaya giriş: `2026-09-01`
- Transfer günü: `20`
- Kuluçka süresi: `21`
- Aktarım: `2026-09-21`
- Tahmini çıkım: `2026-09-22`

## Borç

Kalan borç manuel saklanmaz:

```text
kalan borç = batch.total_price - sum(payments.amount)
```

## Parti Durumları

Geçerli durumlar:

- `RECEIVED`
- `INCUBATING`
- `TRANSFER_DUE`
- `HATCHING`
- `HATCHED`
- `DELIVERED`
- `CANCELLED`

## Raf ve Yerleşim

Bir rafta birden fazla müşteri ve birden fazla parti bulunabilir. Raf, partiye ait kabul edilmez; parti yalnızca seçilen hücreleri kullanır.

Yerleştirme akışı:

1. Personel partiyi seçer.
2. Başlangıç hücresini seçer.
3. Bitiş hücresini seçer.
4. Sistem satır sonundan sonraki satıra devam eden lineer aralığı hesaplar.
5. Dolu hücre varsa işlem reddedilir.

## Çıkım Sepetine Aktarım

Transfer tarihi bugün veya geçmiş olan `INCUBATING` partiler aktarım için uygundur. Aktarım sırasında sepet kapasitesi aşılmaz, raf hücreleri boşaltılır ve parti `HATCHING` olur.
