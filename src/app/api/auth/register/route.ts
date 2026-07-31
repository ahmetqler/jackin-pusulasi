import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken, sessionCookie } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { generateUniqueFriendCode } from "@/lib/friendCode";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const raw = (body ?? {}) as Record<string, unknown>;

  const inviteCode = typeof raw.inviteCode === "string" ? raw.inviteCode.trim() : "";
  if (!process.env.REGISTER_CODE || inviteCode !== process.env.REGISTER_CODE) {
    return NextResponse.json({ error: "Davet kodu geçersiz" }, { status: 403 });
  }

  const username =
    typeof raw.username === "string" ? raw.username.trim().toLowerCase() : "";
  const password = typeof raw.password === "string" ? raw.password : "";
  const displayName =
    typeof raw.displayName === "string" ? raw.displayName.trim() : "";

  if (!USERNAME_RE.test(username)) {
    return NextResponse.json(
      { error: "Kullanıcı adı 3–20 karakter olmalı: küçük harf, rakam, alt çizgi" },
      { status: 400 },
    );
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Şifre en az 6 karakter olmalı" }, { status: 400 });
  }
  if (displayName.length < 1 || displayName.length > 30) {
    return NextResponse.json({ error: "Görünen ad 1–30 karakter olmalı" }, { status: 400 });
  }

  const taken = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (taken) {
    return NextResponse.json({ error: "Bu kullanıcı adı alınmış" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      username,
      displayName,
      passwordHash: await hashPassword(password),
      friendCode: await generateUniqueFriendCode(),
    },
    select: { id: true, username: true, displayName: true, friendCode: true },
  });

  const response = NextResponse.json(user, { status: 201 });
  response.cookies.set(sessionCookie(await createSessionToken(user.id)));
  return response;
}
