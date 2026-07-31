import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma CLI'yi DOĞRUDAN bağlantıya zorlar.
 *
 * Uygulama Neon'un pooler'ına (PgBouncer) bağlanıyor — sunucusuz ortamda
 * bağlantı sayısını dizginlemek için şart. Ama PgBouncer transaction modunda
 * oturum düzeyinde advisory lock desteklemiyor; `prisma migrate` tam da onu
 * kullandığı için pooled adresle "Timed out trying to acquire a postgres
 * advisory lock" hatası veriyor. Üstelik bu hata kararsız: bazen geçiyor,
 * bazen geçmiyor — yani deploy'u rastgele düşürebilecek cinsten.
 *
 * `datasource.url` tek başına yetmiyor: CLI, ortamdaki DATABASE_URL'i öncelikli
 * okuyor. O yüzden değişkenin kendisini burada değiştiriyoruz. Bu dosyayı
 * yalnızca Prisma CLI yüklüyor (migrate, studio, db execute); uygulamanın
 * çalışma anındaki bağlantısı src/lib/prisma.ts içinde ve pooled kalıyor.
 *
 * DIRECT_URL tanımlıysa o kullanılır; değilse Neon adresinden "-pooler" atılarak
 * türetilir, böylece Vercel'e ayrıca bir değişken eklemek gerekmiyor.
 */
const pooled = process.env["DATABASE_URL"];
const direct = process.env["DIRECT_URL"] ?? pooled?.replace("-pooler.", ".");

if (direct) {
  process.env["DATABASE_URL"] = direct;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: direct,
  },
});
