"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  angleDelta,
  applyScreenAngle,
  needsOrientationPermission,
  readHeading,
  requestOrientationPermission,
  smoothAngle,
} from "@/lib/heading";

/** Bu süre içinde tek bir güvenilir okuma gelmezse "Kuzey yukarı" rozetini göster. */
const SETTLE_MS = 2500;

/**
 * Pusulanın "öldüğüne" karar verme süresi.
 *
 * iOS'ta yön izni, uygulama arka plana atılıp geri geldiğinde sessizce
 * düşebiliyor: olaylar akmayı bırakıyor ama hiçbir hata gelmiyor. Bekçi
 * olmayınca son okunan yön ekranda asılı kalıyor ve kullanıcı döndükçe
 * arkadaşının yıldızı YANLIŞ yeri göstermeye başlıyor — donmuş bir pusula,
 * pusulasızlıktan beterdir. Sensör susunca kuzey-yukarıya düşüp "Pusulayı
 * etkinleştir" butonunu göstermek dürüst olan.
 *
 * deviceorientation sensör hızında akar (saniyede onlarca kez) ve cihaz sabit
 * dursa bile gürültüden dolayı susmaz; 4 saniyelik sessizlik gerçekten akışın
 * kesildiği anlamına gelir.
 */
const HEADING_TIMEOUT_MS = 4000;
const WATCHDOG_INTERVAL_MS = 1000;

/** İki render arası en az bu kadar beklenir — olaylar 60 Hz gelebiliyor. */
const APPLY_INTERVAL_MS = 33;

export type HeadingState = {
  /** Ekranın üstünün gösterdiği yön. null ise pusula yok -> kuzey yukarı. */
  heading: number | null;
  /** iOS'ta -1: pusula kalibre değil. */
  accuracy: number | null;
  /** İzin isteyen bir buton göstermenin anlamı var mı (iOS). */
  canRequestPermission: boolean;
  /** İlk okuma beklenirken true — rozeti hemen yakıp söndürmemek için. */
  settling: boolean;
  requestPermission: () => Promise<boolean>;
};

export function useHeading(active: boolean): HeadingState {
  const smoothedRef = useRef<number | null>(null);
  /** Son geçerli okumanın zamanı — bekçi bunu izliyor. */
  const lastEventRef = useRef(0);
  const lastAppliedRef = useRef(0);
  /** Bu açılışta kendiliğinden izin istendi mi — açılış başına bir kez. */
  const autoAskedRef = useRef(false);

  const [heading, setHeading] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [settling, setSettling] = useState(true);
  const [permissionNonce, setPermissionNonce] = useState(0);

  // Yalnızca istemcide bilinebilen bir değer. Sunucuda false döndürüp
  // istemcide gerçek değeri okumak için doğru araç bu; useState + useEffect
  // ile yapmak gereksiz bir ikinci render turu demek.
  const canRequestPermission = useSyncExternalStore(
    () => () => {},
    () => needsOrientationPermission(),
    () => false,
  );

  useEffect(() => {
    if (!active) return;

    // Sıfırdan başla: arka plandan dönüldüğünde eski değerler hâlâ ref'lerde
    // duruyor ve yeni olay gelmese bile ekranda yaşamaya devam ediyordu.
    smoothedRef.current = null;
    lastEventRef.current = 0;
    lastAppliedRef.current = 0;

    const onOrientation = (event: Event) => {
      const reading = readHeading(event as DeviceOrientationEvent);
      if (!reading) return;

      const now = performance.now();
      lastEventRef.current = now;

      // Yumuşatma olay hızında yapılıyor. Eskiden requestAnimationFrame'de
      // yapılıyordu ama rAF arka planda / güç tasarrufunda durabiliyor ve
      // pusula sessizce donuyordu; sensöre bağlı kalmak daha sağlam.
      const next = smoothAngle(smoothedRef.current, applyScreenAngle(reading.heading));
      smoothedRef.current = next;
      setAccuracy(reading.accuracy);

      if (now - lastAppliedRef.current < APPLY_INTERVAL_MS) return;
      lastAppliedRef.current = now;
      setHeading((prev) =>
        prev === null || Math.abs(angleDelta(prev, next)) > 0.3 ? next : prev,
      );
    };

    // İkisini birden dinliyoruz: Chrome absolute'u ayrı olayla yolluyor,
    // iOS ise webkitCompassHeading'i normal deviceorientation'a koyuyor.
    window.addEventListener("deviceorientationabsolute", onOrientation as EventListener);
    window.addEventListener("deviceorientation", onOrientation as EventListener);

    // Bekçi kasten setInterval'da: rAF'ta olsaydı "rAF durdu" durumunu —
    // yani donmanın sebeplerinden birini — yakalayamazdı.
    const watchdog = setInterval(() => {
      if (performance.now() - lastEventRef.current <= HEADING_TIMEOUT_MS) return;
      smoothedRef.current = null;
      setHeading((prev) => (prev === null ? prev : null));
      setAccuracy((prev) => (prev === null ? prev : null));
    }, WATCHDOG_INTERVAL_MS);

    const settleTimer = setTimeout(() => setSettling(false), SETTLE_MS);

    return () => {
      window.removeEventListener("deviceorientationabsolute", onOrientation as EventListener);
      window.removeEventListener("deviceorientation", onOrientation as EventListener);
      clearInterval(watchdog);
      clearTimeout(settleTimer);
    };
  }, [active, permissionNonce]);

  const requestPermission = useCallback(async () => {
    const granted = await requestOrientationPermission();
    if (granted) {
      setSettling(true);
      // Dinleyicileri yeniden kur — izin öncesi kurulanlar iOS'ta sessiz kalıyor.
      setPermissionNonce((n) => n + 1);
    }
    return granted;
  }, []);

  /**
   * İzni İLK DOKUNUŞTA kendiliğinden iste.
   *
   * iOS pusula iznini kalıcı hatırlamıyor: her yeni açılışta bir kullanıcı
   * hareketiyle yeniden istenmesi gerekiyor, bunu değiştirmenin yolu yok.
   * Değiştirebileceğimiz şey, kullanıcının bunun için özel bir butonu bulup
   * basmak zorunda kalması. İzin herhangi bir dokunuşla istenebiliyor — o
   * yüzden ekrana ilk dokunulduğunda sessizce istiyoruz. Daha önce izin
   * verilmişse iOS diyaloğu hiç göstermeden "granted" dönüyor, yani kullanıcı
   * için görünmez oluyor.
   *
   * Sadece veri akmıyorsa kuruluyor ve `once` olduğu için tek sefer çalışıyor:
   * reddedilirse aynı açılışta tekrar tekrar sorulmuyor.
   */
  // Yeni bir açılış (sekme öne geldi) yeni bir deneme hakkı demek.
  useEffect(() => {
    autoAskedRef.current = false;
  }, [active]);

  useEffect(() => {
    if (!active || !needsOrientationPermission()) return;

    let armed = true;
    let cleanupGesture: (() => void) | undefined;

    const arm = setTimeout(() => {
      // Veri akıyorsa gerek yok. Bir kez sorulduysa da tekrar sorma: izin
      // verildiği hâlde sensör susuyorsa (bozuk/kısıtlı cihaz) her dokunuşta
      // yeniden istemenin anlamı olmaz.
      if (!armed || autoAskedRef.current || lastEventRef.current !== 0) return;

      const onGesture = () => {
        autoAskedRef.current = true;
        void requestPermission();
      };
      window.addEventListener("pointerdown", onGesture, { once: true });
      cleanupGesture = () => window.removeEventListener("pointerdown", onGesture);
    }, SETTLE_MS);

    return () => {
      armed = false;
      clearTimeout(arm);
      cleanupGesture?.();
    };
  }, [active, permissionNonce, requestPermission]);

  return { heading, accuracy, canRequestPermission, settling, requestPermission };
}
