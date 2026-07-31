import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";
import { getFriendRequests } from "@/lib/friendRequests";
import { FRIEND_CODE_LENGTH, normalizeFriendCode } from "@/lib/friendCodeFormat";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "yetkisiz" }, { status: 401 });

  return NextResponse.json(await getFriendRequests(userId));
}

/** Arkadaş koduyla istek gönder. */
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "yetkisiz" }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const raw = (body ?? {}) as Record<string, unknown>;
  const code = normalizeFriendCode(typeof raw.code === "string" ? raw.code : "");

  if (code.length !== FRIEND_CODE_LENGTH) {
    return NextResponse.json(
      { error: `Kod ${FRIEND_CODE_LENGTH} karakter olmalı` },
      { status: 400 },
    );
  }

  const target = await prisma.user.findUnique({
    where: { friendCode: code },
    select: { id: true, displayName: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Kod bulunamadı" }, { status: 404 });
  }
  if (target.id === userId) {
    return NextResponse.json({ error: "Bu senin kodun" }, { status: 400 });
  }

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId: target.id },
        { requesterId: target.id, addresseeId: userId },
      ],
    },
    select: { id: true, status: true, addresseeId: true },
  });

  if (existing?.status === "ACCEPTED") {
    return NextResponse.json({ error: "Zaten arkadaşsınız" }, { status: 409 });
  }

  if (existing) {
    // Karşı taraf bana zaten istek atmışsa ve ben de onun kodunu girdiysem,
    // onay adımını beklemenin anlamı yok — iki taraf da rıza göstermiş oldu.
    if (existing.addresseeId === userId) {
      await prisma.friendship.update({
        where: { id: existing.id },
        data: { status: "ACCEPTED", respondedAt: new Date() },
      });
      return NextResponse.json({ status: "accepted", name: target.displayName });
    }
    return NextResponse.json({ status: "pending", name: target.displayName });
  }

  await prisma.friendship.create({
    data: { requesterId: userId, addresseeId: target.id },
  });

  return NextResponse.json({ status: "pending", name: target.displayName }, { status: 201 });
}
