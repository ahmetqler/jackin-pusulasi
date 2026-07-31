import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized } from "@/lib/session";
import { buildRadarPayload } from "@/lib/radar";
import { isValidLat, isValidLng } from "@/lib/geo";

// Aynı kullanıcıdan bu aralıktan sık gelen yazma isteklerini yok say —
// kaçak bir istemci döngüsü veritabanını dövmesin.
const MIN_WRITE_INTERVAL_MS = 3000;

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "yetkisiz" }, { status: 401 });

  // DİKKAT: body koordinat içeriyor. Asla loglanmaz.
  const body: unknown = await request.json().catch(() => null);
  const raw = (body ?? {}) as Record<string, unknown>;
  const lat = typeof raw.lat === "number" ? raw.lat : Number.NaN;
  const lng = typeof raw.lng === "number" ? raw.lng : Number.NaN;

  if (!isValidLat(lat) || !isValidLng(lng)) {
    return NextResponse.json({ error: "Geçersiz konum" }, { status: 400 });
  }

  const accuracyM =
    typeof raw.accuracy === "number" && Number.isFinite(raw.accuracy)
      ? Math.min(100000, Math.max(0, Math.round(raw.accuracy)))
      : null;

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { sharing: true, location: { select: { updatedAt: true } } },
  });
  if (!me) return unauthorized();

  if (!me.sharing) {
    return NextResponse.json({ error: "Görünmez moddasın" }, { status: 409 });
  }

  const now = new Date();
  const tooSoon =
    me.location && now.getTime() - me.location.updatedAt.getTime() < MIN_WRITE_INTERVAL_MS;

  if (!tooSoon) {
    await prisma.location.upsert({
      where: { userId },
      create: { userId, lat, lng, accuracyM, updatedAt: now },
      update: { lat, lng, accuracyM, updatedAt: now },
    });
  }

  const payload = await buildRadarPayload(userId);
  if (!payload) return unauthorized();

  return NextResponse.json(payload);
}

/** Konumumu sil — sunucuda hiçbir kaydım kalmasın. */
export async function DELETE() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "yetkisiz" }, { status: 401 });

  await prisma.location.deleteMany({ where: { userId } });

  const payload = await buildRadarPayload(userId);
  if (!payload) return unauthorized();

  return NextResponse.json(payload);
}
