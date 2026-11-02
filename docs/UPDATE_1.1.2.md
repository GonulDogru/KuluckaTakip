# 1.1.2 — Yumurta kayıtları filtreleri

- Müşteri seçilince yalnız o müşterinin yumurta kabulleri listelenir. Arşivli müşterilerin mevcut kayıtları da seçilebilir.
- Müşteri, telefon, kabul numarası ve yumurta türü adıyla arama yapılabilir. Türkçe büyük/küçük harf ve işaret farkları, telefonun boşluklu/boşluksuz yazımı desteklenir.
- Durum ve yumurta türü seçimi ile sadece borçlu kayıtları gösterme birleştirilebilir. Filtreler istemcide mevcut veri üzerinde çalışır; her tuşta ağ isteği göndermez.
- Seçiciler aranabilir tam ekran listelerle açılır; üst filtre alanı üç kısa seçim olarak kalır.
- Kartlarda mevcut durum rozeti, üstte filtrelenmiş/toplam kayıt sayısı, filtre temizleme ve sonuç bulunamadı açıklaması vardır.
- Ekranı yenilemek filtreleri silmez; kayıt detayına girip dönünce seçimler korunur. Sunucu erişim kuralları değiştirilmez.

TypeScript ve 24 regresyon testi geçti. Filtre testi müşteri ayrımını, birleşik filtreleri, borç kontrolünü, Türkçe aramayı, telefon/kabul numarası aramasını ve temizlenmiş sonucu doğrular. 32/64 bit ARM için yeni ve eski imza serilerinde paketler hazırlanır.

1.1.2 / versionCode 4 bağlı Samsung telefona yüklendi. Müşteri seçince diğer müşterilerin kayıtlarının gizlendiği, müşteri+durum birleşiminin doğru boş sonuç verdiği, arama ve Temizle işlemlerinin çalıştığı fiziksel cihazda doğrulandı. İşlem sırasında kayıt oluşturulmadı/değiştirilmedi; çalışma zamanı hatası görülmedi. Yeni ve eski imza APK dosyalarının SHA-256 özetleri doğrulandı.
