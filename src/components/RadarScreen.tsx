"use client";

import Link from "next/link";
import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import CompassDial, { type DialFriend } from "@/components/CompassDial";
import FriendRow from "@/components/FriendRow";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useHeading } from "@/hooks/useHeading";
import { useNow, usePageActive } from "@/hooks/usePageActive";
import { useRadar } from "@/hooks/useRadar";
import { bearingToCardinal, formatAge, formatDistance } from "@/lib/format";
import { friendColor } from "@/lib/friendColor";

export default function RadarScreen() {
  const active = usePageActive();
  const { fixRef, status: geoStatus } = useGeolocation(active);
  const compass = useHeading(active);
  const { payload, clockOffsetMs, offline, loading, refresh } = useRadar(active, fixRef);
  const now = useNow(1000);
  const [busy, setBusy] = useState(false);

  const northUp = compass.heading === null;
  const serverNow = now + clockOffsetMs;

  const ageOf = (iso: string | null) =>
    iso === null ? null : Math.max(0, serverNow - Date.parse(iso));

  const friends = payload?.friends ?? [];

  // Saniye başı yaşlar değiştiği için memolamanın anlamı yok.
  const dialFriends: DialFriend[] = friends.map((friend) => ({
    id: friend.id,
    bearing: friend.bearing,
    distanceMeters: friend.distanceMeters,
    ageMs: ageOf(friend.updatedAt),
    color: friendColor(friend.id),
  }));

  const nearest = friends.find((f) => f.distanceMeters !== null) ?? null;
  const invisible = payload?.me.sharing === false;

  async function enableSharing() {
    setBusy(true);
    try {
      await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sharing: true }),
      });
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
        <h1 className="text-sm font-semibold uppercase tracking-widest text-muted">
          Jack&apos;in Pusulası
        </h1>
        <div className="flex items-center gap-2">
          {offline && (
            <span className="rounded-full border border-edge px-2 py-0.5 text-xs text-muted">
              Çevrimdışı
            </span>
          )}
          {northUp && !compass.settling && (
            <span className="rounded-full border border-edge px-2 py-0.5 text-xs text-muted">
              Kuzey yukarı
            </span>
          )}
          {compass.accuracy === -1 && (
            <span className="rounded-full border border-edge px-2 py-0.5 text-xs text-muted">
              Pusula şaşkın
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4">
        {geoStatus === "denied" && (
          <Card
            title="Konum izni gerekli"
            body="Yönü ve mesafeyi hesaplayabilmek için konumuna erişmesi lazım. Tarayıcı ayarlarından bu siteye konum iznini aç, sonra sayfayı yenile."
          />
        )}

        {geoStatus === "unavailable" && (
          <Card
            title="Konum kullanılamıyor"
            body="Bu tarayıcı konum vermiyor. Telefonda HTTPS üzerinden açtığından emin ol — konum yalnızca güvenli bağlantıda çalışır."
          />
        )}

        {invisible && (
          <Card
            title="Görünmez moddasın"
            body="Konumun sunucudan silindi. Kimse seni göremez — ama sen de kimsenin yönünü göremezsin."
            action={
              <button
                type="button"
                onClick={enableSharing}
                disabled={busy}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-background disabled:opacity-50"
              >
                Paylaşımı aç
              </button>
            }
          />
        )}

        <div className="pt-2">
          <CompassDial
            friends={dialFriends}
            heading={compass.heading}
            waiting={geoStatus === "waiting"}
            dimmed={invisible}
          />
        </div>

        <div className="text-center">
          {nearest ? (
            <>
              <div className="font-mono text-5xl font-semibold tabular-nums tracking-tight">
                {formatDistance(nearest.distanceMeters!)}
              </div>
              <div className="mt-1 text-sm text-muted">
                {nearest.name}
                {nearest.bearing !== null && northUp && ` · ${bearingToCardinal(nearest.bearing)}`}
                {nearest.updatedAt && ` · ${formatAge(ageOf(nearest.updatedAt)!)}`}
              </div>
            </>
          ) : (
            <div className="text-sm text-muted">
              {loading
                ? "Yükleniyor…"
                : geoStatus === "waiting"
                  ? "Konum alınıyor…"
                  : friends.length === 0
                    ? "Henüz arkadaşın yok"
                    : "Kimsenin konumu yok"}
            </div>
          )}
        </div>

        {compass.canRequestPermission && northUp && (
          <button
            type="button"
            onClick={() => void compass.requestPermission()}
            className="mx-auto rounded-lg border border-edge px-4 py-2 text-sm font-medium"
          >
            Pusulayı etkinleştir
          </button>
        )}

        {friends.length > 0 ? (
          <ul className="overflow-hidden rounded-xl border border-edge bg-surface">
            {friends.map((friend) => (
              <FriendRow
                key={friend.id}
                friend={friend}
                color={friendColor(friend.id)}
                rotation={friend.bearing === null ? null : friend.bearing - (compass.heading ?? 0)}
                ageMs={ageOf(friend.updatedAt)}
                northUp={northUp}
              />
            ))}
          </ul>
        ) : (
          !loading && (
            <Link
              href="/friends"
              className="mx-auto rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background"
            >
              Arkadaş ekle
            </Link>
          )
        )}

        <p className="pb-4 text-center text-xs leading-relaxed text-muted">
          Konum sadece uygulama açıkken güncellenir. Ekran kapanınca herkes için
          durur — yanındaki süreler bunun için.
        </p>
      </main>

      <BottomNav badge={payload?.pendingRequests ?? 0} />
    </div>
  );
}

function Card({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-edge bg-surface p-4">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
