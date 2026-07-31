import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken, sessionCookie } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";

// Kullanıcı bulunamadığında da karşılaştırılacak bir hash. Amaç, yanıt
// süresinden "bu kullanıcı adı var mı" bilgisinin sızmaması.
let dummyHash: Promise<string> | null = null;
function getDummyHash() {
  dummyHash ??= hashPassword(randomUUID());
  return dummyHash;
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const raw = (body ?? {}) as Record<string, unknown>;

  const username =
    typeof raw.username === "string" ? raw.username.trim().toLowerCase() : "";
  const password = typeof raw.password === "string" ? raw.password : "";

  const user = username
    ? await prisma.user.findUnique({
        where: { username },
        select: { id: true, passwordHash: true },
      })
    : null;

  const ok = await verifyPassword(password, user ? user.passwordHash : await getDummyHash());

  if (!user || !ok) {
    return NextResponse.json(
      { error: "Kullanıcı adı veya şifre hatalı" },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie(await createSessionToken(user.id)));
  return response;
}
