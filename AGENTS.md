<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Gizlilik kuralları — pazarlık yok

Bu uygulamanın tek vaadi şu: **kimse kimsenin tam konumunu göremez.** Kod bu vaadi
koruyacak şekilde yazıldı; aşağıdakileri bozan bir değişiklik ürünü anlamsızlaştırır.

1. **Koordinatlar asla loglanmaz.** `lat`, `lng` veya konum içeren bir `body` hiçbir
   yerde `console.log`/`console.error`'a verilmez. Vercel logları kalıcıdır.
2. **`buildRadarPayload()` (`src/lib/radar.ts`) dışarıya veri üreten TEK yerdir.**
   Arkadaş bilgisi döndüren her route buradan geçer. `lat`/`lng` başka hiçbir dosyada
   API yanıtına yazılmaz. Yeni bir alan eklenecekse orada eklenir.
3. **Koordinat sadece POST body'sinde taşınır**, asla URL/query string'de değil —
   Vercel URL'leri loglar, body'leri loglamaz.
4. **Konum geçmişi tutulmaz.** `Location.userId` birincil anahtardır; satır her zaman
   üzerine yazılır. Geçmiş tablosu/kolonu eklenmez.
5. **Kerteriz 50 m altında `null` döner** (`MIN_BEARING_DISTANCE_M`) — GPS hatası
   o mesafede yönü anlamsızlaştırır.

Değişiklik sonrası hızlı kontrol: `/api/friends` ve `/api/location` yanıtlarında
`lat`, `lng`, `accuracy` anahtarları **hiçbir yerde** görünmemeli.
