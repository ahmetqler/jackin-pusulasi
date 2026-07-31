import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";
import { generateUniqueFriendCode } from "@/lib/friendCode";

const profileSelect = {
  id: true,
  username: true,
  displayName: true,
  friendCode: true,
  sharing: true,
} as const;

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "yetkisiz" }, { status: 401 });

  return NextResponse.json(
    await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: profileSelect }),
  );
}

export async function PATCH(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "yetkisiz" }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const raw = (body ?? {}) as Record<string, unknown>;

  if (typeof raw.displayName === "string") {
    const displayName = raw.displayName.trim();
    if (displayName.length < 1 || displayName.length > 30) {
      return NextResponse.json({ error: "Görünen ad 1–30 karakter olmalı" }, { status: 400 });
    }
    await prisma.user.update({ where: { id: userId }, data: { displayName } });
  }

  if (typeof raw.sharing === "boolean") {
    if (raw.sharing) {
      await prisma.user.update({ where: { id: userId }, data: { sharing: true } });
    } else {
      // Görünmez mod sadece bir bayrak değil: kayıtlı konum da silinir.
      // Saklanmayan veri sızmaz.
      await prisma.$transaction([
        prisma.user.update({ where: { id: userId }, data: { sharing: false } }),
        prisma.location.deleteMany({ where: { userId } }),
      ]);
    }
  }

  if (raw.rotateFriendCode === true) {
    await prisma.user.update({
      where: { id: userId },
      data: { friendCode: await generateUniqueFriendCode() },
    });
  }

  return NextResponse.json(
    await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: profileSelect }),
  );
}
