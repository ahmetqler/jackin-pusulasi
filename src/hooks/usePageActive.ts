"use client";

import { useEffect, useState } from "react";

/**
 * Sekme önde mi? Uygulamanın "sadece açıkken konum paylaşır" sözü burada
 * duruyor: false olduğu anda watchPosition ve döngü kapanır.
 */
export function usePageActive(): boolean {
  const [active, setActive] = useState(true);

  useEffect(() => {
    const sync = () => setActive(document.visibilityState === "visible");
    const hide = () => setActive(false);
    sync();

    document.addEventListener("visibilitychange", sync);
    // iOS sayfayı bfcache'e alırken visibilitychange'i atlayabiliyor.
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", sync);

    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", sync);
    };
  }, []);

  return active;
}

/** Yaş etiketleri saniye başı tazelensin diye sade bir tik. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
