"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  angleDelta,
  applyScreenAngle,
  needsOrientationPermission,
  readHeading,
  requestOrientationPermission,
  smoothAngle,
} from "@/lib/heading";

/** Bu süre içinde tek bir güvenilir okuma gelmezse kuzey-yukarı moduna düşeriz. */
const SETTLE_MS = 2500;

export type HeadingState = {
  /** Ekranın üstünün gösterdiği yön. null ise pusula yok -> kuzey yukarı. */
  heading: number | null;
  /** iOS'ta -1: pusula kalibre değil. */
  accuracy: number | null;
  /** İzin isteyen bir buton göstermenin anlamı var mı (iOS). */
  canRequestPermission: boolean;
  /** İlk okuma beklenirken true — rozeti hemen yakıp söndürmemek için. */
  settling: boolean;
  requestPermission: () => Promise<void>;
};

export function useHeading(active: boolean): HeadingState {
  const targetRef = useRef<number | null>(null);
  const smoothedRef = useRef<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [settling, setSettling] = useState(true);
  const [canRequestPermission, setCanRequestPermission] = useState(false);
  const [permissionNonce, setPermissionNonce] = useState(0);

  useEffect(() => {
    setCanRequestPermission(needsOrientationPermission());
  }, []);

  useEffect(() => {
    if (!active) return;

    const onOrientation = (event: Event) => {
      const reading = readHeading(event as DeviceOrientationEvent);
      if (!reading) return;
      targetRef.current = applyScreenAngle(reading.heading);
      setAccuracy(reading.accuracy);
    };

    // İkisini birden dinliyoruz: Chrome absolute'u ayrı olayla yolluyor,
    // iOS ise webkitCompassHeading'i normal deviceorientation'a koyuyor.
    window.addEventListener("deviceorientationabsolute", onOrientation as EventListener);
    window.addEventListener("deviceorientation", onOrientation as EventListener);

    // Yumuşatmayı olay hızında değil kare hızında yapıyoruz; olaylar 60 Hz
    // gelebiliyor ve her biri için render etmenin anlamı yok.
    let frame = requestAnimationFrame(function loop() {
      frame = requestAnimationFrame(loop);
      const target = targetRef.current;
      if (target === null) return;
      const next = smoothAngle(smoothedRef.current, target);
      smoothedRef.current = next;
      setHeading((prev) => (prev === null || Math.abs(angleDelta(prev, next)) > 0.3 ? next : prev));
    });

    const settleTimer = setTimeout(() => setSettling(false), SETTLE_MS);

    return () => {
      window.removeEventListener("deviceorientationabsolute", onOrientation as EventListener);
      window.removeEventListener("deviceorientation", onOrientation as EventListener);
      cancelAnimationFrame(frame);
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
  }, []);

  return { heading, accuracy, canRequestPermission, settling, requestPermission };
}
