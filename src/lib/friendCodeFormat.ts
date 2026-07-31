// Arkadaş kodunun saf yardımcıları. Kod ÜRETİMİ sunucuya ait (node:crypto +
// veritabanı) ve src/lib/friendCode.ts içinde; burası istemcide de kullanılıyor.

export const FRIEND_CODE_LENGTH = 6;

/** Kullanıcının yazdığını karşılaştırılabilir hale getirir: "k3m-7qp " -> "K3M7QP" */
export function normalizeFriendCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Gösterim için gruplar: "K3M7QP" -> "K3M-7QP" */
export function formatFriendCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}
