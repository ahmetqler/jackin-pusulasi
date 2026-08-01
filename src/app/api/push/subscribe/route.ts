import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";

type SubscribeBody = {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
};

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "yetkisiz" }, { status: 401 });

  const body = ((await request.json().catch(() => null)) ?? {}) as SubscribeBody;
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : null;
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : null;
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth : null;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Geçersiz abonelik" }, { status: 400 });
  }

  // Aynı cihaz başka bir hesaba geçmiş olabilir; endpoint tekil olduğu için
  // upsert sahipliği de güncelliyor.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId, p256dh, auth },
    create: { userId, endpoint, p256dh, auth },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "yetkisiz" }, { status: 401 });

  const body = ((await request.json().catch(() => null)) ?? {}) as SubscribeBody;
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : null;

  // endpoint verilmezse bu kullanıcının bütün cihazları kapatılır.
  await prisma.pushSubscription.deleteMany({
    where: { userId, ...(endpoint ? { endpoint } : {}) },
  });

  return NextResponse.json({ ok: true });
}
