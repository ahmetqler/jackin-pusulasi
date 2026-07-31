"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import {
  FRIEND_CODE_LENGTH,
  formatFriendCode,
  normalizeFriendCode,
} from "@/lib/friendCodeFormat";
import { friendColor } from "@/lib/friendColor";
import type { FriendRequests } from "@/lib/friendRequests";
import type { Profile } from "@/lib/profile";
import type { RadarPayload } from "@/lib/radar";

type Props = {
  initialProfile: Profile;
  initialRadar: RadarPayload;
  initialRequests: FriendRequests;
};

/**
 * İlk veri sunucudan prop olarak geliyor — mount'ta fetch etmiyoruz.
 * Yükleme titremesi olmuyor, ekran ilk boyamada dolu geliyor. Sonraki
 * tazelemeler yalnızca kullanıcı bir şey yaptığında (load) çalışıyor.
 */
export default function FriendsScreen({
  initialProfile,
  initialRadar,
  initialRequests,
}: Props) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [radar, setRadar] = useState<RadarPayload>(initialRadar);
  const [incoming, setIncoming] = useState(initialRequests.incoming);
  const [outgoing, setOutgoing] = useState(initialRequests.outgoing);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const [meRes, radarRes, reqRes] = await Promise.all([
      fetch("/api/me"),
      fetch("/api/friends"),
      fetch("/api/friends/requests"),
    ]);

    if (meRes.status === 401) {
      router.replace("/login");
      return;
    }

    if (meRes.ok) setProfile(await meRes.json());
    if (radarRes.ok) setRadar(await radarRes.json());
    if (reqRes.ok) {
      const data = await reqRes.json();
      setIncoming(data.incoming);
      setOutgoing(data.outgoing);
    }
  }, [router]);

  async function addFriend(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/friends/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage({ text: data.error ?? "Eklenemedi", bad: true });
        return;
      }

      setMessage({
        text:
          data.status === "accepted"
            ? `${data.name} artık arkadaşın`
            : `${data.name} kişisine istek gönderildi`,
        bad: false,
      });
      setCode("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function respond(id: string, action: "accept" | "decline") {
    await fetch(`/api/friends/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await load();
  }

  async function removeFriend(id: string, name: string) {
    if (!window.confirm(`${name} arkadaşlıktan çıkarılsın mı?`)) return;
    await fetch(`/api/friends/${id}`, { method: "DELETE" });
    await load();
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(formatFriendCode(profile.friendCode));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setMessage({ text: "Kopyalanamadı, elle seç", bad: true });
    }
  }

  async function shareCode() {
    const text = `Jack'in Pusulası'nda beni ekle. Arkadaş kodum: ${formatFriendCode(profile.friendCode)}`;
    try {
      await navigator.share({ text });
    } catch {
      // Kullanıcı vazgeçti — sessizce geç.
    }
  }

  const friends = radar.friends;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
        <h1 className="text-sm font-semibold uppercase tracking-widest text-muted">
          Arkadaşlar
        </h1>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-6">
        <section className="rounded-xl border border-edge bg-surface p-4 text-center">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted">
            Arkadaş kodun
          </h2>
          <p className="mt-2 font-mono text-3xl font-semibold tracking-[0.2em] text-accent">
            {formatFriendCode(profile.friendCode)}
          </p>
          <div className="mt-3 flex justify-center gap-2">
            <button
              type="button"
              onClick={copyCode}
              className="rounded-lg border border-edge px-3 py-1.5 text-sm font-medium"
            >
              {copied ? "Kopyalandı" : "Kodu kopyala"}
            </button>
            <button
              type="button"
              onClick={shareCode}
              className="rounded-lg border border-edge px-3 py-1.5 text-sm font-medium"
            >
              Paylaş
            </button>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Bu kodu verdiğin kişi sana istek gönderebilir. Sen kabul etmeden
            kimse radarında görünmez.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Arkadaş ekle
          </h2>
          <form onSubmit={addFriend} className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="K3M-7QP"
              autoCapitalize="characters"
              autoCorrect="off"
              maxLength={8}
              className="min-w-0 flex-1 rounded-lg border border-edge bg-surface px-3 py-2.5 font-mono text-base tracking-widest outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={busy || normalizeFriendCode(code).length !== FRIEND_CODE_LENGTH}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-40"
            >
              Ekle
            </button>
          </form>
          {message && (
            <p className={`mt-2 text-sm ${message.bad ? "text-red-500" : "text-accent"}`}>
              {message.text}
            </p>
          )}
        </section>

        {incoming.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
              Gelen istekler
            </h2>
            <ul className="overflow-hidden rounded-xl border border-edge bg-surface">
              {incoming.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center gap-2 border-b border-edge px-4 py-3 last:border-b-0"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{row.person.displayName}</span>
                    <span className="block truncate text-xs text-muted">
                      @{row.person.username}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void respond(row.id, "accept")}
                    className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-background"
                  >
                    Kabul et
                  </button>
                  <button
                    type="button"
                    onClick={() => void respond(row.id, "decline")}
                    className="rounded-lg border border-edge px-3 py-1.5 text-sm"
                  >
                    Reddet
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {outgoing.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
              Gönderilen istekler
            </h2>
            <ul className="overflow-hidden rounded-xl border border-edge bg-surface">
              {outgoing.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center gap-2 border-b border-edge px-4 py-3 last:border-b-0"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {row.person.displayName}
                  </span>
                  <span className="text-sm text-muted">Bekliyor</span>
                  <button
                    type="button"
                    onClick={() => void respond(row.id, "decline")}
                    className="rounded-lg border border-edge px-3 py-1.5 text-sm"
                  >
                    İptal
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Arkadaşların
          </h2>
          {friends.length === 0 ? (
            <p className="rounded-xl border border-dashed border-edge px-4 py-6 text-center text-sm text-muted">
              Henüz arkadaşın yok. Kodunu paylaş ya da onun kodunu gir.
            </p>
          ) : (
            <ul className="overflow-hidden rounded-xl border border-edge bg-surface">
              {friends.map((friend) => (
                <li
                  key={friend.id}
                  className="flex items-center gap-3 border-b border-edge px-4 py-3 last:border-b-0"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: friendColor(friend.id) }}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{friend.name}</span>
                  <button
                    type="button"
                    onClick={() => void removeFriend(friend.id, friend.name)}
                    className="rounded-lg border border-edge px-3 py-1.5 text-sm text-muted"
                  >
                    Çıkar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <BottomNav badge={incoming.length} />
    </div>
  );
}
