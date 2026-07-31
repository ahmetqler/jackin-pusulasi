"use client";

import { useEffect, useRef, useState } from "react";

export type Fix = {
  lat: number;
  lng: number;
  accuracy: number;
  /** Cihaz saati — sadece "bu fix bayat mı" karşılaştırması için. */
  timestamp: number;
};

export type GeoStatus = "idle" | "waiting" | "ok" | "denied" | "unavailable";

/**
 * Konum takibi.
 *
 * getCurrentPosition'ı aralıkla çağırmak yerine watchPosition kullanılıyor:
 * tek seferlik yüksek hassasiyet çağrıları (özellikle iOS'ta) her seferinde
 * soğuktan başlayıp 5–15 sn gecikiyor. watchPosition oturumu sıcak tutuyor.
 * Android saniyede bir tetiklediği için gönderme işi ayrı: en taze fix burada
 * ref'te bekler, yükleme sadece 10 sn'lik döngüde yapılır.
 */
export function useGeolocation(active: boolean) {
  const fixRef = useRef<Fix | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [status, setStatus] = useState<GeoStatus>("waiting");

  useEffect(() => {
    if (!active) return;

    const geolocation = typeof navigator === "undefined" ? undefined : navigator.geolocation;
    if (!geolocation) {
      // setState efekt gövdesinde senkron çağrılmıyor — React bunu zincirleme
      // render sayıyor. Zaten çok nadir bir dal: asıl gerçek hayat vakası olan
      // "güvensiz bağlantı" durumunda API var ama hata callback'i tetikleniyor.
      const timer = setTimeout(() => setStatus("unavailable"), 0);
      return () => clearTimeout(timer);
    }

    const watchId = geolocation.watchPosition(
      (position) => {
        const next: Fix = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now(),
        };
        fixRef.current = next;
        setFix(next);
        setStatus("ok");
      },
      (error) => {
        // POSITION_UNAVAILABLE / TIMEOUT durumunda durumu değiştirmiyoruz:
        // elimizdeki son fix'le devam etmek daha doğru.
        if (error.code === error.PERMISSION_DENIED) setStatus("denied");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );

    return () => geolocation.clearWatch(watchId);
  }, [active]);

  return { fix, fixRef, status };
}
