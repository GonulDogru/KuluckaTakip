# KuluckaTakip

Expo + React Native + TypeScript ile Android öncelikli kuluçka takip uygulaması.

## Çalıştırma

```bash
npm install
npm run start
```

Expo Go ile QR kodu okutun. Varsayılan port doluysa `npx expo start --port 8082` kullanılabilir.

## Supabase Kurulumu

1. Supabase projesi oluştur.
2. `database/migrations/20260914215000_initial_schema.sql` dosyasındaki SQL migration'ı Supabase SQL Editor içinde çalıştır.
3. Project Settings > API bölümünden URL ve anon key al.
4. `.env.example` dosyasını örnek alarak `.env` oluştur:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

5. Expo'yu tamamen kapatıp yeniden başlat.

Supabase bilgileri yoksa uygulama development ortamında demo veriyle çalışır ve "Demo Mod" göstergesi görünür.

## Kontroller

```bash
npx tsc --noEmit
npx expo install --check
```

## Bu Aşamada Demo Kalanlar

Raf yerleşimi, makine verileri, SMS, bildirimler, authentication ve gelişmiş roller henüz gerçek servise bağlanmadı.
