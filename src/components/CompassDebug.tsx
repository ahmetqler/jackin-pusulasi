"use client";

import { useEffect, useState } from "react";
import { applyScreenAngle, readHeading, requestOrientationPermission } from "@/lib/heading";

type Raw = {
  alpha: number | null;
  absolute: boolean;
  webkit: number | null;
  webkitAccuracy: number | null;
  screenAngle: number;
  heading: number | null;
};

/**
 * "Ok yanlış yeri gösteriyor" şikâyetini 10 saniyelik teşhise çeviren panel.
 * Ok seninle birlikte dönüyorsa bearing - heading işareti ters; sabit
 * 90/180/270 kayıksa suçlu screen.orientation.angle terimi.
 */
export default function CompassDebug() {
  const [raw, setRaw] = useState<Raw | null>(null);

  useEffect(() => {
    const onOrientation = (event: Event) => {
      const e = event as DeviceOrientationEvent & {
        webkitCompassHeading?: number;
        webkitCompassAccuracy?: number;
      };
      const reading = readHeading(e);
      setRaw({
        alpha: typeof e.alpha === "number" ? e.alpha : null,
        absolute: Boolean(e.absolute),
        webkit: typeof e.webkitCompassHeading === "number" ? e.webkitCompassHeading : null,
        webkitAccuracy:
          typeof e.webkitCompassAccuracy === "number" ? e.webkitCompassAccuracy : null,
        screenAngle:
          typeof screen !== "undefined" && screen.orientation ? screen.orientation.angle : 0,
        heading: reading ? applyScreenAngle(reading.heading) : null,
      });
    };

    window.addEventListener("deviceorientationabsolute", onOrientation as EventListener);
    window.addEventListener("deviceorientation", onOrientation as EventListener);
    return () => {
      window.removeEventListener("deviceorientationabsolute", onOrientation as EventListener);
      window.removeEventListener("deviceorientation", onOrientation as EventListener);
    };
  }, []);

  const rows: [string, string][] = [
    ["alpha", raw?.alpha === null || raw === null ? "—" : raw.alpha.toFixed(1)],
    ["absolute", raw ? String(raw.absolute) : "—"],
    ["webkitCompassHeading", raw?.webkit === null || raw === null ? "—" : raw.webkit.toFixed(1)],
    [
      "webkitCompassAccuracy",
      raw?.webkitAccuracy === null || raw === null ? "—" : String(raw.webkitAccuracy),
    ],
    ["screen.orientation.angle", raw ? String(raw.screenAngle) : "—"],
    ["heading (ekran üstü)", raw?.heading === null || raw === null ? "—" : raw.heading.toFixed(1)],
  ];

  return (
    <details className="rounded-xl border border-edge bg-surface">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
        Pusula hata ayıklama
      </summary>
      <div className="border-t border-edge px-4 py-3">
        <dl className="space-y-1 font-mono text-xs">
          {rows.map(([key, value]) => (
            <div key={key} className="flex justify-between gap-3">
              <dt className="text-muted">{key}</dt>
              <dd className="tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          onClick={() => void requestOrientationPermission()}
          className="mt-3 rounded-lg border border-edge px-3 py-1.5 text-sm"
        >
          Pusula izni iste
        </button>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Telefonu düz tut, sabit dur ve kendi etrafında yavaşça dön. Radar
          ekranındaki ok arkadaşta kilitli kalmalı, K/D/G/B halkası dönmeli.
        </p>
      </div>
    </details>
  );
}
