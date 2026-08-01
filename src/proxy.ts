import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// Next 16'da middleware.ts yok — dosyanın adı proxy.ts, fonksiyon adı proxy.
// Node.js runtime'da çalışır (edge desteklenmiyor).
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const userId = token ? await verifySessionToken(token) : null;

  if (userId) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "yetkisiz" }, { status: 401 });
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

// Beyaz liste — negatif regex yerine kasten tek tek sayıldı. Böylece /login,
// /register, /api/auth/*, /sw.js, /manifest.webmanifest ve /icons/* yanlışlıkla
// kilitlenemez (klasik middleware tuzağı).
export const config = {
  matcher: [
    "/",
    "/friends/:path*",
    "/settings/:path*",
    "/api/me/:path*",
    "/api/location/:path*",
    "/api/friends/:path*",
    "/api/push/:path*",
  ],
};
