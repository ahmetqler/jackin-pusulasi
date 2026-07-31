# Jack'in Pusulası

Haritasız arkadaş radarı. Arkadaşının **tam konumunu kimse görmez**; sadece
şunlar görünür:

- **yön** — telefonu çevirdikçe arkadaşını işaret etmeye devam eden bir ok
- **mesafe** — "820 m", "12,4 km"
- **tazelik** — "2 dk önce"

Konum yalnızca uygulama ekranda açıkken güncellenir. Ekran kapanınca iki taraf
için de durur; tazelik etiketi bunu dürüstçe söyler.

## Kurulum

1. **Veritabanı.** [neon.com](https://neon.com) üzerinde ücretsiz bir Postgres
   aç ve **pooled** bağlantı dizesini (host'unda `-pooler` geçen) kopyala.

2. **`.env`** dosyasını doldur (`.env.example` şablon):

   ```
   DATABASE_URL="postgresql://...-pooler.../neondb?sslmode=require"
   SESSION_SECRET="..."   # node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   REGISTER_CODE="..."    # bunu bilmeyen hesap açamaz
   ```

   ⚠ Değerlerdeki her `$` karakterini `\$` olarak kaçır — Next.js `.env`
   içindeki `$...` ifadelerini genişletiyor.

3. **Şemayı uygula ve çalıştır:**

   ```bash
   npx prisma migrate dev --name init
   npm run icons
   npm run dev
   ```

## Telefonda test

Konum ve pusula API'leri **yalnızca HTTPS'te** çalışır — `http://192.168.x.x:3000`
işe yaramaz. En pratik yol Vercel'e deploy edip gerçek URL üzerinden test etmek.
Yerelde denemek istersen `npm run dev:https`.

Vercel'de `DATABASE_URL`, `SESSION_SECRET`, `REGISTER_CODE` değişkenlerini
Production **ve** Preview için tanımla — build sırasında `prisma migrate deploy`
çalıştığı için `DATABASE_URL` build aşamasında da gerekli.

## Gizlilik

Kodun uyduğu kurallar [AGENTS.md](AGENTS.md) içinde.

- Sunucu paylaşım açıkken tam koordinatı görür, ama **sadece son konumu** tutar.
  `Location.userId` birincil anahtar; geçmiş biriktirmek yapısal olarak imkânsız.
- Arkadaşlara giden yanıtta koordinat **yok** — sadece yön ve yuvarlanmış mesafe.
  Bunu üreten tek yer `src/lib/radar.ts` içindeki `buildRadarPayload()`.
- 50 m altında kerteriz verilmez (GPS gürültüsü), 24 saatten eski konumlar
  kendiliğinden silinir, görünmez mod kayıtlı konumu siler.
- Dürüst sınır: farklı yerlerden ölçüm alan bir arkadaş yön + mesafeden konumu
  kabaca hesaplayabilir. Bu "harita yok" uygulaması, "bulunamaz" uygulaması değil.

## Mimari notları

- Next.js 16 (`middleware.ts` değil **`proxy.ts`**), Prisma 7 + `@prisma/adapter-pg`,
  Tailwind v4. Server Actions kullanılmıyor, her mutasyon route handler.
- Tek döngü (`src/hooks/useRadar.ts`): taze konum varsa `POST /api/location`
  (yanıtı zaten radar), yoksa `GET /api/friends`.
- Pusula matematiği `src/lib/heading.ts`; ok yanlış yeri gösteriyorsa
  Ayarlar → "Pusula hata ayıklama" panelini aç.
