"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RadarPayload } from "@/lib/radar";
import type { Fix } from "@/hooks/useGeolocation";

const TICK_MS = 10_000;
/** Bundan eski bir fix'i sunucuya göndermenin anlamı yok. */
const FIX_MAX_AGE_MS = 45_000;

export type RadarState = {
  payload: RadarPayload | null;
  /** sunucu saati - cihaz saati. Yaş hesapları bununla düzeltilir. */
  clockOffsetMs: number;
  offline: boolean;
  loading: boolean;
  refresh: () => void;
};

/**
 * Tek döngü: taze konum varsa POST /api/location, yoksa GET /api/friends.
 * Konum yazma isteği zaten radar yanıtını döndürdüğü için tik başına tek istek
 * yeterli ve kerteriz her zaman az önce yazılan konumdan hesaplanmış olur.
 */
export function useRadar(
  active: boolean,
  fixRef: React.RefObject<Fix | null>,
): RadarState {
  const router = useRouter();
  const [payload, setPayload] = useState<RadarPayload | null>(null);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const inFlight = useRef(false);

  const apply = useCallback((next: RadarPayload) => {
    setPayload(next);
    setClockOffsetMs(Date.parse(next.serverNow) - Date.now());
    setOffline(false);
    setLoading(false);
  }, []);

  const tick = useCallback(async () => {
    if (inFlight.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setOffline(true);
      return;
    }

    inFlight.current = true;
    try {
      const fix = fixRef.current;
      const fresh = fix && Date.now() - fix.timestamp < FIX_MAX_AGE_MS;

      const response = fresh
        ? await fetch("/api/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy }),
          })
        : await fetch("/api/friends");

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      // 409 = görünmez mod. Konum yazılmaz ama radar yine de gösterilir.
      if (response.status === 409) {
        const fallback = await fetch("/api/friends");
        if (fallback.ok) apply(await fallback.json());
        return;
      }

      if (response.ok) apply(await response.json());
    } catch {
      setOffline(true);
    } finally {
      inFlight.current = false;
    }
  }, [apply, fixRef, router]);

  useEffect(() => {
    if (!active) return;

    // İlk tik efekt gövdesinde senkron çağrılmıyor (React zincirleme render
    // sayıyor), ama bir sonraki turda hemen çalışıyor — 10 sn beklenmiyor.
    const run = () => void tick();
    const first = setTimeout(run, 0);
    const id = setInterval(run, TICK_MS);
    const onOnline = run;
    const onOffline = () => setOffline(true);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      clearTimeout(first);
      clearInterval(id);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [active, tick]);

  return { payload, clockOffsetMs, offline, loading, refresh: () => void tick() };
}
