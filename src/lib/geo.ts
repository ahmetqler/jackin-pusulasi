// Küresel geometri. Saf fonksiyonlar — hiçbir yerde konum saklamaz, loglamaz.

const EARTH_RADIUS_M = 6371008.8; // IUGG ortalama Dünya yarıçapı

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/**
 * İki nokta arasındaki büyük daire mesafesi (metre).
 * asin biçimi kullanıldı; kayan nokta kayması sqrt(h) değerini 1'in bir tık
 * üstüne itebildiği için min(1, ...) ile kırpılıyor.
 */
export function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const phi1 = toRad(aLat);
  const phi2 = toRad(bLat);
  const dPhi = toRad(bLat - aLat);
  const dLambda = toRad(bLng - aLng);

  const h =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * A'dan B'ye başlangıç kerterizi: 0–360 derece, saat yönünde, gerçek kuzeyden.
 * (Büyük daire üzerinde ilerledikçe kerteriz değişir; kısa mesafelerde fark yok.)
 */
export function initialBearingDeg(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const phi1 = toRad(aLat);
  const phi2 = toRad(bLat);
  const dLambda = toRad(bLng - aLng);

  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Mesafeyi kabalaştır. Hem gizlilik (tam metre vermeyelim) hem de gösterim
 * istikrarı için — GPS gürültüsü yüzünden sayı sürekli oynamasın.
 */
export function quantizeDistance(meters: number): number {
  if (meters < 100) return Math.round(meters / 10) * 10;
  if (meters < 1000) return Math.round(meters / 50) * 50;
  if (meters < 10000) return Math.round(meters / 100) * 100;
  return Math.round(meters / 1000) * 1000;
}

/**
 * Bu mesafenin altında kerteriz döndürülmez.
 * Telefon GPS'i ±10–30 m şaşar; 50 m'nin altında hesaplanan yön gürültüden
 * ibarettir ve ok deli gibi döner. UI bunun yerine "Çok yakın" gösterir.
 */
export const MIN_BEARING_DISTANCE_M = 50;

export function isValidLat(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLng(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180;
}
