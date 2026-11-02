# Kuluçka Takip görsel tasarımı

26 Ekim 2026

SMS merkezi için ek düzenleme: Gönderim hakkında paneli kaldırıldı, çıkış bağlantısı listenin sonuna taşındı. Tek satırda eşit genişlikte üç sayılı filtre bulunur: Taslaklar, Gönderilecekler, Gönderilenler. Kontrol gerektiren başarısız ve sonucu belirsiz kayıtlar gerçek durumları korunarak Taslaklar'da, gönderimi süren kayıtlar Gönderilecekler'de yer alır. Yalnız QUEUED durumundaki kayıtlarda gönderim düğmesi açılır. Seçili grubun kayıtları sanallaştırılmış listede gösterilir. Bölüm başlıkları renkli ikon ve açıklama ile sunulur. Ortak sayfa başlıkları daha küçük mavi yazı, kırmızı üst etiket ve iki renkli vurgu çizgisi kullanır. Gerçek SMS gönderim onayı korunur.

Sıcak kırık beyaz zemin, canlı kobalt mavi, mercan kırmızı ve civciv sarısı. Ana sayfa, müşteri ve yumurta listeleri, SMS merkezi, giriş ve kayıt formları ortak renkleri ve yuvarlatılmış bileşenleri kullanır. Alt menüde yerel View bileşenleriyle çizilen ikonlar vardır; yeni bir ikon veya animasyon bağımlılığı eklenmedi.

İllüstrasyon uygulamayla birlikte paketlenir; harici görsel URL'sine veya ağdan indirmeye ihtiyaç duymaz. Bellek önbelleği ve oturum akışı korunmuştur. Ürün ekranlarındaki teknik SMS açıklamaları kullanıcıya dönük kısa bir açıklamaya çevrilmiştir; gönderim onayı korunmuştur.

## Görsel kaynağı

- Araç: yerleşik `image_gen` (imagegen becerisi), CLI kullanılmadı.
- Dosya: `assets/hatchery-family.png`.
- Son kullanılan üretim istemi:

```text
Use case: stylized-concept. Asset type: landscape hero illustration embedded locally in a Turkish hatchery management mobile app. Create a polished premium tactile 3D clay illustration, landscape 3:2 composition. A beautiful friendly white hen with a bright scarlet red comb, two fluffy golden yellow baby chicks and three cream eggs, one eggshell hatching, grouped on the right two thirds of the image. A small cobalt blue egg tray. Soft warm ivory background #FFF5DF, gentle realistic soft contact shadows, warm morning studio light, sophisticated rounded forms and feather detail, charming agricultural brand, restrained elegant composition. Left third has mostly open ivory background with a tiny scattered feather, generous breathing room around subjects. Rich cobalt blue and vivid tomato red accents, yellow chicks. Image fills canvas; no border, NO text, no typography, no logos, no watermark, no UI, no people. Clear recognizable hen, chicks and eggs, visually refined not a generic emoji.
```

## Kontroller

TypeScript kontrolü ve mevcut 16 oturum/sorgu regresyon testi geçti. Release APK başarıyla derlendi ve bağlı Samsung SM-S711B telefona mevcut veriler korunarak yüklendi. Ana sayfa, müşteri ve yumurta ekranlarının ekran görüntüleri incelendi; SMS sekmesine geçiş ve çalışma zamanı hata günlükleri kontrol edildi. Görsel kontrolde saptanan ana görsel yüksekliği ve uzun menü etiketi düzeltildi. SMS gönderimi ve veri oluşturan işlemler yalnız görsel kontrol için çalıştırılmadı.
