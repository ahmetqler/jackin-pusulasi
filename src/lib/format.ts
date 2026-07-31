/** 820 -> "820 m", 12400 -> "12,4 km" (Türkçe ondalık ayırıcı virgül). */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  const km = meters / 1000;
  const text = km < 100 ? km.toFixed(1) : String(Math.round(km));
  return `${text.replace(".", ",")} km`;
}

/**
 * Tazelik etiketi. Fark sunucu saatine göre hesaplanmış milisaniye —
 * telefonun saati bozuksa "-4 dk önce" çıkmasın diye.
 */
export function formatAge(ageMs: number): string {
  const seconds = Math.max(0, Math.floor(ageMs / 1000));
  if (seconds < 20) return "az önce";
  if (seconds < 60) return `${seconds} sn önce`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} dk önce`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "dün";
  return `${days} gün önce`;
}

/** Kadranda kullanılacak kısa hâli: "2 dk". */
export function formatAgeShort(ageMs: number): string {
  const seconds = Math.max(0, Math.floor(ageMs / 1000));
  if (seconds < 60) return "şimdi";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} dk`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa`;
  return `${Math.floor(hours / 24)} g`;
}

const CARDINALS = [
  "kuzey",
  "kuzeydoğu",
  "doğu",
  "güneydoğu",
  "güney",
  "güneybatı",
  "batı",
  "kuzeybatı",
] as const;

/** 42 -> "kuzeydoğu". Pusula yokken yön sözle anlatılsın diye. */
export function bearingToCardinal(bearing: number): string {
  return CARDINALS[Math.round(((bearing % 360) + 360) % 360 / 45) % 8];
}
