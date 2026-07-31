import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

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
