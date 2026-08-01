"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import CompassDebug from "@/components/CompassDebug";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { formatFriendCode } from "@/lib/friendCodeFormat";
import type { Profile } from "@/lib/profile";
import { STAR_COLORS } from "@/lib/starColors";

export default function SettingsScreen({ initialProfile }: { initialProfile: Profile }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [name, setName] = useState(initialProfile.displayName);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>, message: string) {
    setBusy(true);
    setNote(null);
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        const data: Profile = await response.json();
        setProfile(data);
        setName(data.displayName);
        setNote(message);
      } else {
        const data = await response.json().catch(() => ({}));
        setNote(data.error ?? "Kaydedilemedi");
      }
    } finally {
      setBusy(false);
    }
  }

  async function deleteLocation() {
    if (!window.confirm("Sunucudaki kayıtlı konumun silinsin mi?")) return;
    setBusy(true);
    try {
      await fetch("/api/location", { method: "DELETE" });
      setNote("Konumun silindi");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const sharing = profile.sharing;
  const push = usePushSubscription();

  async function togglePush() {
    if (push.subscribed) {
      await push.disable();
      setNote("Bildirimler kapatıldı");
      return;
    }
    const error = await push.enable();
    setNote(error ?? "Bildirimler açıldı");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
        <h1 className="text-sm font-semibold uppercase tracking-widest text-muted">Ayarlar</h1>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-6">
        <section className="rounded-xl border border-edge bg-surface p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
              Görünen ad
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              className="w-full rounded-lg border border-edge bg-background px-3 py-2.5 text-base outline-none focus:border-accent"
            />
          </label>
          <button
            type="button"
            disabled={busy || !name.trim() || name === profile.displayName}
            onClick={() => void patch({ displayName: name.trim() }, "Adın güncellendi")}
            className="mt-3 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-background disabled:opacity-40"
          >
            Kaydet
          </button>
          <p className="mt-3 text-xs text-muted">
            @{profile.username} · kod {formatFriendCode(profile.friendCode)}
          </p>
        </section>

        {push.supported && (
          <section className="rounded-xl border border-edge bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">Bildirimler</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {push.denied
                    ? "Bildirimleri tarayıcı ayarlarından engellemişsin. Oradan izin verip tekrar dene."
                    : "Arkadaşın seni merak edip dürttüğünde haberin olsun. Bildirime dokununca uygulama açılır ve konumun güncellenir."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void togglePush()}
                disabled={push.busy || push.denied}
                aria-pressed={push.subscribed}
                className={`mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
                  push.subscribed ? "bg-accent" : "bg-edge"
                }`}
              >
                <span
                  className={`block h-6 w-6 rounded-full bg-background transition-transform ${
                    push.subscribed ? "translate-x-6" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {push.subscribed && (
              <label className="mt-4 flex items-center justify-between gap-3 border-t border-edge pt-3">
                <span className="text-sm">
                  Arkadaşlarım beni dürtebilsin
                  <span className="mt-0.5 block text-xs text-muted">
                    Kapatırsan kimse sana &ldquo;uygulamayı aç&rdquo; bildirimi gönderemez.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={profile.acceptsNudges}
                  disabled={busy}
                  onChange={(e) =>
                    void patch(
                      { acceptsNudges: e.target.checked },
                      e.target.checked ? "Dürtmeye açıksın" : "Dürtme kapatıldı",
                    )
                  }
                  className="h-5 w-5 shrink-0 accent-[var(--accent)]"
                />
              </label>
            )}
          </section>
        )}

        <section className="rounded-xl border border-edge bg-surface p-4">
          <h2 className="font-semibold">Yıldızının rengi</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Arkadaşların seni bu renkte görür. Kalabalıkta kimin nerede olduğunu
            ayırt etmeye yarar.
          </p>
          <div className="mt-3 flex flex-wrap gap-2.5">
            {STAR_COLORS.map((option) => {
              const active = profile.color === option.hex;
              return (
                <button
                  key={option.hex}
                  type="button"
                  disabled={busy}
                  aria-label={option.name}
                  aria-pressed={active}
                  onClick={() => void patch({ color: option.hex }, `Rengin: ${option.name}`)}
                  className={`h-9 w-9 rounded-full transition-transform ${
                    active ? "scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-surface" : ""
                  }`}
                  style={{ backgroundColor: option.hex }}
                />
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-edge bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Görünmez mod</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Açtığında kayıtlı konumun silinir ve yenisi yazılmaz. Kimse seni
                göremez — ama sen de kimsenin yönünü göremezsin.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!sharing}
              disabled={busy}
              onClick={() =>
                void patch(
                  { sharing: !sharing },
                  sharing ? "Görünmez moddasın" : "Paylaşım açık",
                )
              }
              className={`mt-1 h-7 w-12 shrink-0 rounded-full transition-colors ${
                !sharing ? "bg-accent" : "bg-edge"
              }`}
            >
              <span
                className={`block h-5 w-5 rounded-full bg-surface transition-transform ${
                  !sharing ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void deleteLocation()}
            disabled={busy}
            className="rounded-xl border border-edge bg-surface px-4 py-3 text-left text-sm font-medium"
          >
            Konumumu sil
            <span className="mt-0.5 block text-xs font-normal text-muted">
              Sunucudaki son konum kaydını hemen siler.
            </span>
          </button>
          <button
            type="button"
            onClick={() =>
              void patch({ rotateFriendCode: true }, "Yeni arkadaş kodun hazır")
            }
            disabled={busy}
            className="rounded-xl border border-edge bg-surface px-4 py-3 text-left text-sm font-medium"
          >
            Arkadaş kodunu yenile
            <span className="mt-0.5 block text-xs font-normal text-muted">
              Kod başkasının eline geçtiyse eskisi işe yaramaz hale gelir.
            </span>
          </button>
        </section>

        {note && <p className="text-sm text-accent">{note}</p>}

        <CompassDebug />

        <section className="rounded-xl border border-edge bg-surface p-4">
          <h2 className="font-semibold">Gizlilik</h2>
          <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted">
            <p>
              Sunucu, paylaşım açıkken tam koordinatını görür ve saklar — ama
              yalnızca <strong className="text-foreground">son konumu</strong>.
              Geçmiş kaydı yok, her yeni konum eskisinin üzerine yazılır.
            </p>
            <p>
              Arkadaşların koordinatını{" "}
              <strong className="text-foreground">asla</strong> görmez. Onlara
              giden tek şey yön ve yuvarlanmış mesafe. 24 saatten eski konumlar
              kendiliğinden silinir.
            </p>
            <p>
              Dürüst uyarı: farklı yerlerden ölçüm alan bir arkadaş, yön ve
              mesafeden konumunu kabaca hesaplayabilir. Bu bir &quot;harita
              yok&quot; uygulaması, &quot;bulunamaz&quot; uygulaması değil.
              Asıl koruma, kimi eklediğin.
            </p>
          </div>
        </section>

        <button
          type="button"
          onClick={() => void logout()}
          className="rounded-xl border border-edge px-4 py-3 text-sm font-medium text-red-500"
        >
          Çıkış yap
        </button>
      </main>

      <BottomNav />
    </div>
  );
}
