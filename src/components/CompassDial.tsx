"use client";

import { useLayoutEffect, useRef } from "react";
import { accumulate } from "@/lib/heading";

const C = 160; // kadran merkezi (viewBox 320x320)
const R_OUTER = 140;
const R_NEEDLE_MIN = 45;
const R_NEEDLE_MAX = 140;
const R_NEEDLE_BASE = 40;

/** 5 dakikada tamamen solar. */
const FADE_MS = 5 * 60 * 1000;
/** Bunun ötesinde ibre kesikli çizilir. */
const STALE_MS = 15 * 60 * 1000;

export type DialFriend = {
  id: string;
  bearing: number | null;
  distanceMeters: number | null;
  ageMs: number | null;
  color: string;
};

type Props = {
  friends: DialFriend[];
  /** Ekranın üstünün gösterdiği yön. null ise kuzey yukarı çizilir. */
  heading: number | null;
  /** Konum bekleniyor — merkez nefes alsın. */
  waiting?: boolean;
  /** Görünmez mod: kadran sönük. */
  dimmed?: boolean;
};

/**
 * İbre uzunluğu logaritmik: 200 m ile 20 km aynı kadranda okunabilsin diye.
 * Asıl gerçek her zaman yazan sayı; uzunluk sadece bir göz ipucu.
 */
function needleRadius(meters: number): number {
  const t = Math.log10(1 + meters / 50) / Math.log10(1 + 20000 / 50);
  return R_NEEDLE_MIN + (R_NEEDLE_MAX - R_NEEDLE_MIN) * Math.min(1, Math.max(0, t));
}

function freshnessOpacity(ageMs: number | null): number {
  if (ageMs === null) return 1;
  return Math.min(1, Math.max(0.3, 1 - ageMs / FADE_MS));
}

/**
 * Açıyı DOM'a doğrudan yazar ve biriktirir.
 *
 * Neden inline style değil: CSS rotate 359deg -> 1deg geçişinde tam tur atar.
 * Bunu engellemek için gösterilen açının sarmayan hâlini saklamak gerekiyor
 * (359 -> 361 diye devam eder), o da render'dan değil ancak efektten yazılabilir.
 */
function RotatingGroup({
  angle,
  opacity,
  children,
}: {
  angle: number;
  opacity?: number;
  children: React.ReactNode;
}) {
  const ref = useRef<SVGGElement>(null);
  const displayed = useRef<number | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const first = displayed.current === null;
    const next = first ? angle : accumulate(displayed.current!, angle);
    displayed.current = next;

    // İlk yerleştirmede geçiş kapalı, yoksa kadran her açılışta 0'dan savrulur.
    if (first) {
      element.style.transition = "none";
      element.style.transform = `rotate(${next}deg)`;
      requestAnimationFrame(() => {
        element.style.transition = "transform 150ms linear";
      });
    } else {
      element.style.transform = `rotate(${next}deg)`;
    }
  }, [angle]);

  return (
    <g ref={ref} style={{ transformOrigin: `${C}px ${C}px` }} opacity={opacity}>
      {children}
    </g>
  );
}

export default function CompassDial({ friends, heading, waiting, dimmed }: Props) {
  return (
    <svg
      viewBox="0 0 320 320"
      className="w-full h-auto select-none"
      style={{ opacity: dimmed ? 0.3 : 1, transition: "opacity 300ms ease" }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="center-glow">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Halkalar — radar hissi, harita değil */}
      <circle cx={C} cy={C} r={R_OUTER} fill="none" stroke="var(--edge)" strokeWidth={1} />
      <circle
        cx={C}
        cy={C}
        r={95}
        fill="none"
        stroke="var(--edge)"
        strokeWidth={1}
        strokeDasharray="2 6"
        opacity={0.6}
      />
      <circle
        cx={C}
        cy={C}
        r={50}
        fill="none"
        stroke="var(--edge)"
        strokeWidth={1}
        strokeDasharray="2 6"
        opacity={0.6}
      />

      {/* Yön halkası: -heading ile ters döner, böylece K fiziksel kuzeyi gösterir */}
      <RotatingGroup angle={heading === null ? 0 : -heading}>
        {[0, 90, 180, 270].map((angle) => {
          const rad = ((angle - 90) * Math.PI) / 180;
          const label = { 0: "K", 90: "D", 180: "G", 270: "B" }[angle];
          const isNorth = angle === 0;
          return (
            <g key={angle}>
              <line
                x1={C + Math.cos(rad) * (R_OUTER - 10)}
                y1={C + Math.sin(rad) * (R_OUTER - 10)}
                x2={C + Math.cos(rad) * R_OUTER}
                y2={C + Math.sin(rad) * R_OUTER}
                stroke={isNorth ? "var(--accent)" : "var(--muted)"}
                strokeWidth={isNorth ? 2 : 1}
              />
              <text
                x={C + Math.cos(rad) * (R_OUTER + 13)}
                y={C + Math.sin(rad) * (R_OUTER + 13)}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={13}
                fontWeight={isNorth ? 700 : 500}
                fill={isNorth ? "var(--accent)" : "var(--muted)"}
              >
                {label}
              </text>
            </g>
          );
        })}
        {[45, 135, 225, 315].map((angle) => {
          const rad = ((angle - 90) * Math.PI) / 180;
          return (
            <line
              key={angle}
              x1={C + Math.cos(rad) * (R_OUTER - 5)}
              y1={C + Math.sin(rad) * (R_OUTER - 5)}
              x2={C + Math.cos(rad) * R_OUTER}
              y2={C + Math.sin(rad) * R_OUTER}
              stroke="var(--edge)"
              strokeWidth={1}
            />
          );
        })}
      </RotatingGroup>

      {/* Arkadaş ibreleri */}
      {friends.map((friend) => {
        if (friend.bearing === null || friend.distanceMeters === null) return null;

        const tip = needleRadius(friend.distanceMeters);
        const stale = friend.ageMs !== null && friend.ageMs > STALE_MS;

        return (
          <RotatingGroup
            key={friend.id}
            angle={friend.bearing - (heading ?? 0)}
            opacity={freshnessOpacity(friend.ageMs)}
          >
            <path
              d={`M ${C} ${C - tip} L ${C + 5.5} ${C - R_NEEDLE_BASE} L ${C - 5.5} ${C - R_NEEDLE_BASE} Z`}
              fill={stale ? "none" : friend.color}
              stroke={friend.color}
              strokeWidth={stale ? 1 : 0}
              strokeDasharray={stale ? "3 3" : undefined}
            />
            <circle cx={C} cy={C - tip} r={4.5} fill={friend.color} />
          </RotatingGroup>
        );
      })}

      {/* Merkez: sen */}
      <circle cx={C} cy={C} r={30} fill="url(#center-glow)" />
      {waiting && (
        <circle
          className="pulse-ring"
          cx={C}
          cy={C}
          r={26}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.5}
        />
      )}
      <circle cx={C} cy={C} r={5} fill="var(--accent)" />
    </svg>
  );
}
