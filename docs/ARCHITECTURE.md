# Architecture

Uygulama katmanları:

- `src/lib/supabase.ts`: merkezi Supabase client ve yapılandırma kontrolü
- `src/services`: componentlerden bağımsız repository/service fonksiyonları
- `src/utils`: telefon, tarih ve para formatlama yardımcıları
- `src/data`: Supabase yokken çalışan demo fallback verisi
- `src/screens`: ekran bileşenleri
- `src/components`: ortak UI parçaları

React componentleri doğrudan Supabase sorgusu yazmaz. Veri erişimi `customerService`, `batchService`, `paymentService` ve `eggTypeService` üzerinden yapılır.

Supabase environment değişkenleri yoksa servisler demo bellek verisini kullanır. Böylece Expo Go akışı ve mevcut raf haritası çökmeye devam etmez.

Bu aşamada eklenen operasyon servisleri:

- `machineService`
- `rackService`
- `placementService`
- `hatchBasketService`
- `dashboardService`

Raf haritası `placement_cells` verisinden matrise dönüştürülür. UI tarafı dolu hücre seçimini engeller; DB tarafı unique constraint ile race condition'a karşı son korumayı sağlar.
