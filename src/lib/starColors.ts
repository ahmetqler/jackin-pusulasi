// Kullanıcının seçebileceği yıldız renkleri.
//
// Serbest renk seçici yok: koyu zeminde okunmayan renkler (lacivert, kahve,
// koyu mor) kadranı işe yaramaz hâle getirirdi. Buradakilerin hepsi gece
// gökyüzünde parlıyor.
export const STAR_COLORS = [
  { hex: "#e8c37a", name: "Altın" },
  { hex: "#7dd3fc", name: "Buz" },
  { hex: "#fda4af", name: "Gül" },
  { hex: "#c4b5fd", name: "Menekşe" },
  { hex: "#86efac", name: "Nane" },
  { hex: "#fcd34d", name: "Amber" },
  { hex: "#67e8f9", name: "Turkuaz" },
  { hex: "#f9a8d4", name: "Pembe" },
  { hex: "#fca5a5", name: "Mercan" },
  { hex: "#a3e635", name: "Fıstık" },
] as const;

export const DEFAULT_STAR_COLOR = STAR_COLORS[0].hex;

export function isStarColor(value: unknown): value is string {
  return typeof value === "string" && STAR_COLORS.some((c) => c.hex === value);
}

/** Kayıt sırasında rastgele bir renk — herkes aynı altınla başlamasın. */
export function randomStarColor(): string {
  return STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)].hex;
}
