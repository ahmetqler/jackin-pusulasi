"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { needsOrientationPermission, readHeading, requestOrientationPermission } from "@/lib/heading";
import type { PushState } from "@/hooks/usePushSubscription";

/**
 * İzinlerin tek yerden görünümü.
 *
 * Web uygulaması telefonun ayarlar ekranını AÇAMAZ — iOS'ta böyle bir API yok
 * (eski `app-settings:` şeması kapatıldı), Android'de de güvenilir bir yolu
 * yok. Yapabileceğimizin en iyisi: her iznin canlı durumunu göstermek,
 * istenebilir durumdaysa buradan istemek, engellenmişse cihaza özel adımları
 * yazmak. Bir izin bir kez reddedildiğinde onu yalnızca işletim sistemi geri
 * açabilir; uygulamanın tekrar sorma hakkı kalmaz.
 */

type Durum = "veriliyor" | "verildi" | "reddedildi" | "istenebilir" | "yok" | "bilinmiyor";

const ETIKET: Record<Durum, string> = {
  veriliyor: "Kontrol ediliyor…",
  verildi: "Açık",
  reddedildi: "Engellendi",
  istenebilir: "Kapalı",
  yok: "Desteklenmiyor",
  bilinmiyor: "Bilinmiyor",
};

/** Değişmeyen istemci gerçekleri için: abone olunacak bir şey yok. */
const NOOP_SUBSCRIBE = () => () => {};

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS kendini masaüstü Safari gibi tanıtıyor.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function Rozet({ durum }: { durum: Durum }) {
  const renk =
    durum === "verildi"
      ? "border-accent text-accent"
      : durum === "reddedildi"
        ? "border-red-500/60 text-red-400"
        : "border-edge text-muted";
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${renk}`}>
      {ETIKET[durum]}
    </span>
  );
}

function Satir({
  baslik,
  aciklama,
  durum,
  eylem,
  adimlar,
}: {
  baslik: string;
  aciklama: string;
  durum: Durum;
  eylem?: { etiket: string; onClick: () => void; disabled?: boolean };
  adimlar?: string[];
}) {
  const [acik, setAcik] = useState(false);

  return (
    <div className="border-t border-edge py-3 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium">{baslik}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{aciklama}</p>
        </div>
        <Rozet durum={durum} />
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {eylem && (
          <button
            type="button"
            onClick={eylem.onClick}
            disabled={eylem.disabled}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-background disabled:opacity-40"
          >
            {eylem.etiket}
          </button>
        )}
        {adimlar && adimlar.length > 0 && (
          <button
            type="button"
            onClick={() => setAcik((v) => !v)}
            className="rounded-lg border border-edge px-3 py-1.5 text-sm"
          >
            {acik ? "Gizle" : "Nasıl açılır?"}
          </button>
        )}
      </div>

      {acik && adimlar && (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-muted">
          {adimlar.map((adim) => (
            <li key={adim}>{adim}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function PermissionsSection({ push }: { push: PushState }) {
  const [konum, setKonum] = useState<Durum>("bilinmiyor");
  const [pusula, setPusula] = useState<Durum>("veriliyor");
  const [konumBusy, setKonumBusy] = useState(false);
  const pusulaGeldi = useRef(false);

  const ios = isIOS();
  const standalone = isStandalone();

  // Cihaz yeteneği: sunucuda bilinemez, istemcide de hiç değişmez.
  const konumVar = useSyncExternalStore(
    NOOP_SUBSCRIBE,
    () => Boolean(navigator.geolocation),
    () => true,
  );
  const pusulaVar = useSyncExternalStore(
    NOOP_SUBSCRIBE,
    () => "DeviceOrientationEvent" in window,
    () => true,
  );

  // Konum: Permissions API varsa canlı takip et. Safari'de bu sorgu her sürümde
  // desteklenmiyor; desteklenmiyorsa kullanıcı "İzin ver"e basınca öğreniyoruz.
  useEffect(() => {
    if (!konumVar || !navigator.permissions?.query) return;

    let status: PermissionStatus | null = null;
    const uygula = () => {
      if (!status) return;
      setKonum(
        status.state === "granted"
          ? "verildi"
          : status.state === "denied"
            ? "reddedildi"
            : "istenebilir",
      );
    };

    navigator.permissions
      .query({ name: "geolocation" })
      .then((s) => {
        status = s;
        uygula();
        s.addEventListener("change", uygula);
      })
      .catch(() => {});

    return () => status?.removeEventListener("change", uygula);
  }, [konumVar]);

  // Pusula: kısa bir dinleme ile gerçekten okuma gelip gelmediğine bakıyoruz.
  // "İzin verildi mi" diye soran bir API yok; tek güvenilir kanıt akan veri.
  useEffect(() => {
    if (!pusulaVar) return;

    const onOrientation = (event: Event) => {
      if (!readHeading(event as DeviceOrientationEvent)) return;
      pusulaGeldi.current = true;
      setPusula("verildi");
    };

    window.addEventListener("deviceorientationabsolute", onOrientation as EventListener);
    window.addEventListener("deviceorientation", onOrientation as EventListener);

    const timer = setTimeout(() => {
      if (pusulaGeldi.current) return;
      setPusula(needsOrientationPermission() ? "istenebilir" : "yok");
    }, 2500);

    return () => {
      window.removeEventListener("deviceorientationabsolute", onOrientation as EventListener);
      window.removeEventListener("deviceorientation", onOrientation as EventListener);
      clearTimeout(timer);
    };
  }, [pusulaVar]);

  const konumIste = useCallback(() => {
    setKonumBusy(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        setKonum("verildi");
        setKonumBusy(false);
      },
      (error) => {
        setKonum(error.code === error.PERMISSION_DENIED ? "reddedildi" : "istenebilir");
        setKonumBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }, []);

  const pusulaIste = useCallback(async () => {
    const granted = await requestOrientationPermission();
    if (!granted) setPusula("reddedildi");
    // İzin verildiyse dinleyiciler zaten akan veriyi yakalayıp "verildi" yapar.
  }, []);

  const bildirimDurumu: Durum = !push.supported
    ? "yok"
    : push.denied
      ? "reddedildi"
      : push.subscribed
        ? "verildi"
        : "istenebilir";

  const konumAdimlari = ios
    ? [
        "Ayarlar → Gizlilik ve Güvenlik → Konum Servisleri (en üstteki anahtar açık olmalı)",
        "Listeden Safari Web Siteleri → Uygulamayı Kullanırken",
        "Aynı ekranda Tam Konum açık olmalı — kapalıysa mesafe kilometrelerce şaşar",
        standalone
          ? "Ana ekrandaki uygulamada hâlâ sormuyorsa: simgeye basılı tut → Uygulamayı Sil, sonra Safari'den tekrar Ana Ekrana Ekle"
          : "Sonra bu sayfayı yenile",
      ]
    : [
        "Adres çubuğundaki kilit simgesine bas",
        "İzinler (veya Site ayarları) → Konum → İzin ver",
        "Sayfayı yenile",
      ];

  const pusulaAdimlari = ios
    ? ["Ayarlar → Safari → Hareket ve Yön Erişimi'ni aç", "Uygulamayı kapatıp yeniden aç"]
    : ["Tarayıcı site ayarlarından hareket sensörlerine izin ver"];

  const bildirimAdimlari = ios
    ? [
        "Bildirim yalnızca ana ekrana eklenmiş uygulamada çalışır — Safari sekmesinde çalışmaz",
        "Ayarlar → Bildirimler → Pusula → İzin Ver",
        "Hiç görünmüyorsa uygulamayı silip Safari'den tekrar Ana Ekrana Ekle",
      ]
    : [
        "Adres çubuğundaki kilit simgesine bas",
        "İzinler → Bildirimler → İzin ver",
        "Sayfayı yenile",
      ];

  return (
    <section className="rounded-xl border border-edge bg-surface p-4">
      <h2 className="font-semibold">İzinler</h2>
      <p className="mt-1 mb-3 text-sm leading-relaxed text-muted">
        Uygulama telefonun ayarlarını kendi kendine açamaz — böyle bir izin
        tarayıcıya verilmiyor. Ama buradan durumu görebilir, kapalı olanı
        açabilirsin.
      </p>

      <Satir
        baslik="Konum"
        aciklama="Olmadan yön ve mesafe hesaplanamaz."
        durum={konumVar ? konum : "yok"}
        eylem={
          konumVar && (konum === "istenebilir" || konum === "bilinmiyor")
            ? { etiket: konumBusy ? "Soruluyor…" : "İzin ver", onClick: konumIste, disabled: konumBusy }
            : undefined
        }
        adimlar={konum === "reddedildi" ? konumAdimlari : undefined}
      />

      <Satir
        baslik="Pusula"
        aciklama="Olmadan da çalışır ama küre telefonla dönmez, kuzey hep yukarıda kalır."
        durum={pusulaVar ? pusula : "yok"}
        eylem={
          pusulaVar && pusula === "istenebilir"
            ? { etiket: "İzin ver", onClick: () => void pusulaIste() }
            : undefined
        }
        adimlar={pusula === "reddedildi" ? pusulaAdimlari : undefined}
      />

      <Satir
        baslik="Bildirimler"
        aciklama="Arkadaşın seni dürttüğünde haberin olur."
        durum={bildirimDurumu}
        eylem={
          bildirimDurumu === "istenebilir"
            ? { etiket: "İzin ver", onClick: () => void push.enable(), disabled: push.busy }
            : bildirimDurumu === "verildi"
              ? { etiket: "Kapat", onClick: () => void push.disable(), disabled: push.busy }
              : undefined
        }
        adimlar={bildirimDurumu === "reddedildi" ? bildirimAdimlari : undefined}
      />
    </section>
  );
}
