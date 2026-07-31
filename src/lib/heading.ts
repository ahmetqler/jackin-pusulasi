// Cihaz pusulası. Buradaki her fonksiyon saf — hook'lar src/hooks/useHeading.ts.
//
// Ekrandaki okun açısı:  rotation = bearing - heading
// heading = ekranın ÜST kenarının gösterdiği pusula yönü.

type CompassEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
};

export type HeadingReading = {
  /** 0–360, saat yönünde, kuzeyden. */
  heading: number;
  /** iOS'ta -1 gelirse pusula kalibre değil demektir. */
  accuracy: number | null;
};

/**
 * Olaydan güvenilir bir pusula yönü çıkar; çıkmıyorsa null.
 *
 * İki ayrı dünya var:
 * - iOS Safari `webkitCompassHeading` verir: zaten 0–360, saat yönünde,
 *   manyetik kuzeyden. Doğrudan kullanılır.
 * - Standart API `alpha` verir: kuzeyden ama saat yönünün TERSİNE, o yüzden
 *   360 - alpha. Ayrıca yalnızca `absolute` true ise kuzey referanslıdır;
 *   relative alpha rastgele bir başlangıç noktasına göredir, kullanılmaz.
 */
export function readHeading(event: DeviceOrientationEvent): HeadingReading | null {
  const e = event as CompassEvent;

  if (typeof e.webkitCompassHeading === "number" && !Number.isNaN(e.webkitCompassHeading)) {
    return {
      heading: ((e.webkitCompassHeading % 360) + 360) % 360,
      accuracy: typeof e.webkitCompassAccuracy === "number" ? e.webkitCompassAccuracy : null,
    };
  }

  if (e.absolute && typeof e.alpha === "number" && !Number.isNaN(e.alpha)) {
    return { heading: (360 - e.alpha) % 360, accuracy: null };
  }

  return null;
}

/**
 * Cihazın "doğal üstü" ile ekranın üstü, telefon yan çevrildiğinde ayrışır.
 * Kurulu PWA portrait'e kilitli ama tarayıcıda değil.
 */
export function applyScreenAngle(deviceHeading: number): number {
  const angle =
    typeof screen !== "undefined" && screen.orientation ? screen.orientation.angle : 0;
  return (deviceHeading + angle + 360) % 360;
}

/** İki açı arasındaki en kısa fark: -180..180. */
export function angleDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/**
 * Açısal alçak geçiren filtre. Sıradan bir ortalama 359° -> 1° geçişini
 * yanlış yönden alır; fark üzerinden gidince doğru.
 */
export function smoothAngle(prev: number | null, next: number, alpha = 0.15): number {
  if (prev === null) return next;
  return (prev + alpha * angleDelta(prev, next) + 360) % 360;
}

/**
 * CSS rotate için sarmayan açı üretir.
 *
 * `transform: rotate()` bir geçişle birlikte 359deg'den 1deg'e giderken tam tur
 * atar. Çözüm: gösterilen açıyı bir yerde biriktirip üstüne hep en kısa farkı
 * eklemek — 359 -> 361 diye devam eder, ekranda aynı ama dönüş doğru yönden.
 */
export function accumulate(displayed: number, target: number): number {
  return displayed + angleDelta(((displayed % 360) + 360) % 360, target);
}

type PermissionCapableDOE = {
  requestPermission?: () => Promise<PermissionState | "granted" | "denied">;
};

/** iOS 13+ pusula için açık izin ister ve bunu ancak kullanıcı hareketiyle kabul eder. */
export function needsOrientationPermission(): boolean {
  if (typeof window === "undefined") return false;
  const DOE = window.DeviceOrientationEvent as unknown as PermissionCapableDOE | undefined;
  return typeof DOE?.requestPermission === "function";
}

export async function requestOrientationPermission(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const DOE = window.DeviceOrientationEvent as unknown as PermissionCapableDOE | undefined;
  if (typeof DOE?.requestPermission !== "function") return true;
  try {
    return (await DOE.requestPermission()) === "granted";
  } catch {
    return false;
  }
}
