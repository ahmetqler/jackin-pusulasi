// Doğrudan hex — kadran canvas'a çiziliyor ve canvas CSS değişkeni okuyamaz.
const FRIEND_COLORS = [
  "#e8c37a", // altın
  "#7dd3fc", // buz mavisi
  "#fda4af", // gül
  "#c4b5fd", // menekşe
  "#86efac", // nane
];

/**
 * Renk arkadaşın id'sinden türetilir, listedeki sırasından değil — liste
 * mesafeye göre sıralandığı için sıra sürekli değişiyor ve renkler yer
 * değiştirseydi gökyüzündeki çıkıntının kime ait olduğu anlaşılmazdı.
 */
export function friendColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return FRIEND_COLORS[hash % FRIEND_COLORS.length];
}
