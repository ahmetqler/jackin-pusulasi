import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized } from "@/lib/session";
import { getProfile } from "@/lib/profile";
import { generateUniqueFriendCode } from "@/lib/friendCode";
import { isStarColor } from "@/lib/starColors";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "yetkisiz" }, { status: 401 });

  const profile = await getProfile(userId);
  if (!profile) return unauthorized();

  return NextResponse.json(profile);
}

export async function PATCH(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "yetkisiz" }, { status: 401 });

  if (!(await getProfile(userId))) return unauthorized();

  const body: unknown = await request.json().catch(() => null);
  const raw = (body ?? {}) as Record<string, unknown>;

  if (typeof raw.displayName === "string") {
    const displayName = raw.displayName.trim();
    if (displayName.length < 1 || displayName.length > 30) {
      return NextResponse.json({ error: "Görünen ad 1–30 karakter olmalı" }, { status: 400 });
    }
    await prisma.user.update({ where: { id: userId }, data: { displayName } });
  }

  if (raw.color !== undefined) {
    // Paletle sınırlı: koyu zeminde okunmayan bir renk kadranı işe yaramaz
    // hâle getirir, üstelik bu renk arkadaşlarının ekranında da görünüyor.
    if (!isStarColor(raw.color)) {
      return NextResponse.json({ error: "Geçersiz renk" }, { status: 400 });
    }
    await prisma.user.update({ where: { id: userId }, data: { color: raw.color } });
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

  const updated = await getProfile(userId);
  if (!updated) return unauthorized();

  return NextResponse.json(updated);
}
