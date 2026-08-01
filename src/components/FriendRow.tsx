"use client";

import type { FriendView } from "@/lib/radar";
import { bearingToCardinal, formatAgeShort, formatDistance } from "@/lib/format";

type Props = {
  friend: FriendView;
  color: string;
  /** Ekrandaki ok yönü (bearing - heading). null ise ok çizilmez. */
  rotation: number | null;
  ageMs: number | null;
  /** Pusula yoksa yön sözle anlatılır: "kuzeydoğu". */
  northUp: boolean;
  /** Konumu bayatladıysa "Dürt" butonu gösterilir; yoksa undefined. */
  onNudge?: () => void;
  nudging?: boolean;
};

export default function FriendRow({
  friend,
  color,
  rotation,
  ageMs,
  northUp,
  onNudge,
  nudging,
}: Props) {
  const status = (() => {
    if (!friend.sharing) return "Gizli";
    if (friend.updatedAt === null) return "Konum yok";
    if (friend.distanceMeters === null) return "—";
    if (friend.bearing === null) return "Çok yakın";
    return null;
  })();

  return (
    <li className="flex items-center gap-3 border-b border-edge px-4 py-3 last:border-b-0">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center">
        {rotation === null ? (
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: color, opacity: status ? 0.4 : 1 }}
          />
        ) : (
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
            <g
              style={{
                transform: `rotate(${rotation}deg)`,
                transformOrigin: "12px 12px",
                transition: "transform 150ms linear",
              }}
            >
              <path d="M 12 3 L 17 20 L 12 16.5 L 7 20 Z" fill={color} />
            </g>
          </svg>
        )}
      </span>

      <span className="min-w-0 flex-1 truncate font-medium">{friend.name}</span>

      {status ? (
        <span className="text-sm text-muted">{status}</span>
      ) : (
        <span className="flex items-baseline gap-2">
          {northUp && friend.bearing !== null && (
            <span className="text-xs text-muted">{bearingToCardinal(friend.bearing)}</span>
          )}
          <span className="font-mono tabular-nums text-sm">
            {formatDistance(friend.distanceMeters!)}
          </span>
        </span>
      )}

      {onNudge ? (
        <button
          type="button"
          onClick={onNudge}
          disabled={nudging}
          className="shrink-0 rounded-full border border-edge px-2.5 py-1 text-xs font-medium text-muted disabled:opacity-40"
        >
          {nudging ? "…" : "Dürt"}
        </button>
      ) : (
        <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums text-muted">
          {ageMs === null ? "" : formatAgeShort(ageMs)}
        </span>
      )}
    </li>
  );
}
