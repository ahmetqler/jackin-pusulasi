"use client";

import { useCallback, useEffect, useState } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/**
 * VAPID anahtarı base64url; PushManager ham bayt istiyor.
 *
 * Tampon açıkça ArrayBuffer olarak yaratılıyor: `new Uint8Array(n)` tipi
 * ArrayBufferLike oluyor ve applicationServerKey onu kabul etmiyor.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export type PushState = {
  /** Tarayıcı push destekliyor ve sunucuda anahtarlar tanımlı mı. */
  supported: boolean;
  subscribed: boolean;
  busy: boolean;
  /** Kullanıcı bildirimleri kalıcı olarak reddetmiş — buton işe yaramaz. */
  denied: boolean;
  enable: () => Promise<string | null>;
  disable: () => Promise<void>;
};

export function usePushSubscription(): PushState {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (
      !VAPID_PUBLIC_KEY ||
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      return;
    }

    let cancelled = false;
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (cancelled) return;
        setSupported(true);
        setSubscribed(Boolean(subscription));
        setDenied(Notification.permission === "denied");
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async (): Promise<string | null> => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setDenied(permission === "denied");
        return "Bildirim izni verilmedi";
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
      });

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });
      if (!response.ok) return "Abonelik sunucuya kaydedilemedi";

      setSubscribed(true);
      setDenied(false);
      return null;
    } catch {
      return "Bildirimler açılamadı";
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      // Önce sunucudan sil: tarayıcıdan silip sunucu kaydı kalırsa ölü
      // aboneliğe gönderim denenmeye devam eder.
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription?.endpoint }),
      });
      await subscription?.unsubscribe();
      setSubscribed(false);
    } catch {
      // sessiz geç: yeniden denemek zararsız
    } finally {
      setBusy(false);
    }
  }, []);

  return { supported, subscribed, busy, denied, enable, disable };
}
