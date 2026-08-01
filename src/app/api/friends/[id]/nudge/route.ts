import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";
import { PUSH_ENABLED, sendPushToUser } from "@/lib/push";

/**
 * Konumu bundan tazeyse dürtmenin anlamı yok — arkadaş zaten uygulamayı
 * açmış demektir.
 */
const STALE_AFTER_MS = 15 * 60 * 1000;

/**
 * Aynı kişiye bu aralıktan sık dürtme gönderilemez.
 *
 * Sınır olmadan bu buton kolayca bir rahatsız etme aracına dönüşür. Amaç
 * "merak ettim, haberin olsun" demek; dürtme oyuncağı olmak değil.
 */
const COOLDOWN_MS = 30 * 60 * 1000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "yetkisiz" }, { status: 401 });

  if (!PUSH_ENABLED) {
    return NextResponse.json({ error: "Bildirimler bu sunucuda kapalı" }, { status: 503 });
  }

  const { id: friendId } = await params;
  if (friendId === userId) {
    return NextResponse.json({ error: "Kendini dürtemezsin" }, { status: 400 });
  }

  const friendship = await prisma.friendship.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: userId, addresseeId: friendId },
        { requesterId: friendId, addresseeId: userId },
      ],
    },
    select: { id: true },
  });
  if (!friendship) {
    return NextResponse.json({ error: "Arkadaş bulunamadı" }, { status: 404 });
  }

  const [me, friend, lastNudge] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } }),
    prisma.user.findUnique({
      where: { id: friendId },
      select: {
        displayName: true,
        acceptsNudges: true,
        location: { select: { updatedAt: true } },
        _count: { select: { pushSubscriptions: true } },
      },
    }),
    prisma.nudge.findUnique({
      where: { fromId_toId: { fromId: userId, toId: friendId } },
      select: { sentAt: true },
    }),
  ]);

  if (!me || !friend) {
    return NextResponse.json({ error: "Arkadaş bulunamadı" }, { status: 404 });
  }

  if (!friend.acceptsNudges) {
    return NextResponse.json(
      { error: `${friend.displayName} dürtülmeyi kapatmış` },
      { status: 403 },
    );
  }

  if (friend._count.pushSubscriptions === 0) {
    return NextResponse.json(
      { error: `${friend.displayName} bildirimleri açmamış` },
      { status: 409 },
    );
  }

  const now = Date.now();

  if (lastNudge && now - lastNudge.sentAt.getTime() < COOLDOWN_MS) {
    const minutes = Math.ceil((COOLDOWN_MS - (now - lastNudge.sentAt.getTime())) / 60000);
    return NextResponse.json(
      { error: `Az önce dürttün, ${minutes} dk sonra tekrar deneyebilirsin` },
      { status: 429 },
    );
  }

  const fresh =
    friend.location && now - friend.location.updatedAt.getTime() < STALE_AFTER_MS;
  if (fresh) {
    return NextResponse.json(
      { error: `${friend.displayName} zaten uygulamada` },
      { status: 400 },
    );
  }

  const delivered = await sendPushToUser(friendId, {
    title: "Jack'in Pusulası",
    body: `${me.displayName} seni merak ediyor — uygulamayı aç ki yerini görsün.`,
  });

  if (delivered === 0) {
    return NextResponse.json(
      { error: `${friend.displayName}'e ulaşılamadı` },
      { status: 502 },
    );
  }

  // Yön başına tek satır, üzerine yazılıyor: dürtme geçmişi tutulmuyor.
  await prisma.nudge.upsert({
    where: { fromId_toId: { fromId: userId, toId: friendId } },
    update: { sentAt: new Date(now) },
    create: { fromId: userId, toId: friendId, sentAt: new Date(now) },
  });

  return NextResponse.json({ ok: true, name: friend.displayName });
}
