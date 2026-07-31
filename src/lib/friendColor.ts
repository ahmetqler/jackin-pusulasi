const FRIEND_COLORS = [
  "var(--friend-1)",
  "var(--friend-2)",
  "var(--friend-3)",
  "var(--friend-4)",
  "var(--friend-5)",
];

/**
 * Renk arkadaşın id'sinden türetilir, listedeki sırasından değil — liste
 * mesafeye göre sıralandığı için sıra sürekli değişiyor ve renkler yer
 * değiştirseydi kadrandaki ibre kimin olduğu anlaşılmazdı.
 */
export function friendColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return FRIEND_COLORS[hash % FRIEND_COLORS.length];
}
