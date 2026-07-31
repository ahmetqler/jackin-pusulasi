import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, clearedSessionCookie, verifySessionToken } from "@/lib/auth";

/**
 * Oturum sahibinin id'si, yoksa null.
 *
 * proxy.ts yetki sınırı DEĞİL — sadece giriş yapmamış kullanıcıyı /login'e
 * yönlendiren bir kolaylık. Yetki denetimi her route handler'ın kendi işi;
 * hepsi bu fonksiyonu çağırır.
 */
export async function getUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

/**
 * 401 + çerezi temizle.
 *
 * Jetonun imzası geçerli olduğu hâlde arkasındaki kullanıcı yoksa (hesap
 * silinmiş, veritabanı sıfırlanmış) bu yolu kullanıyoruz. Aksi hâlde sunucu
 * 500 atıyor ve istemci sonsuza kadar "Yükleniyor…" ekranında kalıyor.
 */
export function unauthorized() {
  const response = NextResponse.json({ error: "yetkisiz" }, { status: 401 });
  response.cookies.set(clearedSessionCookie());
  return response;
}
