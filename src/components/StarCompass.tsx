"use client";

import { useEffect, useRef } from "react";

/**
 * Gece göğü pusulası.
 *
 * Yıldızlar bir çember üzerinde saat yönünün TERSİNE akar. Arkadaşın bulunduğu
 * yönde çember dışa doğru sivrilir — arkadaş yakınsa uzun ve keskin bir köşe,
 * uzaksa hafif ama seçilebilir bir tümsek. Yani "çekim" ne kadar yakınsa o
 * kadar güçlü.
 *
 * Yıldızlar akar ama çıkıntı ekranda sabit durur: yıldızlar çıkıntının içinden
 * geçip yollarına devam eder. Böylece hem dönme hissi hem de doğru yön aynı
 * anda korunur.
 *
 * Hacim hissi DERİNLİKTEN gelir, perspektiften değil. Çemberi elips gibi
 * yatırmak 3B görünürdü ama açıları kaydırırdı; bu uygulamanın tek işi doğru
 * yönü göstermek olduğu için çember tam daire kalıyor. Bunun yerine yıldızlar
 * bir halka kesiti içinde öne/arkaya dağılıyor: öndekiler büyük ve parlak,
 * arkadakiler küçük ve sönük, üstelik hafif paralaksla biraz daha dışarıda.
 */

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
  /** Konum bekleniyor. */
  waiting?: boolean;
  /** Görünmez mod: gökyüzü söner. */
  dimmed?: boolean;
};

const RING_STARS = 440;
const SKY_STARS = 260;

/** Çıkıntı ölçeğinin uçları. */
const NEAR_M = 50;
const FAR_M = 300_000;

const R_RING = 0.28; // çemberin yarıçapı (kenar uzunluğuna oran)
const AMP_NEAR = 0.17; // 50 m'de çıkıntının boyu
const AMP_FAR = 0.022; // 300 km'de çıkıntının boyu
const SIGMA_SHARP = 0.06; // radyan — yakındaki sivri ucun genişliği
const SIGMA_SOFT = 0.3; // radyan — uzaktaki yayvan tümseğin genişliği

/** Halkanın kesit kalınlığı ve derinlik paralaksı. */
const BAND = 0.022;
const PARALLAX = 0.05;

const FADE_MS = 5 * 60 * 1000;

const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Deterministik gürültü — her açılışta aynı gökyüzü. */
function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function mix(a: [number, number, number], b: [number, number, number], t: number) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ] as [number, number, number];
}

/** En kısa açısal fark (radyan). */
function angleDiff(a: number, b: number): number {
  return Math.abs(((a - b + Math.PI * 3) % TAU) - Math.PI);
}

type Bump = {
  angle: number;
  amp: number;
  /** 0 = yakın (sivri uç), 1 = uzak (yayvan tümsek). */
  softness: number;
  /**
   * Renk ve parlaklığın ne kadar bastıracağı. Çıkıntının BOYU zaten mesafeyle
   * küçülüyor; bu da olmazsa 300 km'deki arkadaş 60 m'deki kadar parlak
   * oluyor ve uzaklık hissi kayboluyor. Yine de sıfıra inmiyor — rengi
   * görünmezse çıkıntının kime ait olduğu anlaşılmaz.
   */
  presence: number;
  rgb: [number, number, number];
};

/**
 * Çıkıntının profili.
 *
 * Yakında üstel (`e^-|d|/σ`) kullanılıyor: tepe noktasında kırılan, gerçek bir
 * köşe veriyor. Uzakta gauss eğrisi: tepesi yuvarlak, yayvan bir tümsek.
 * Arası mesafeye göre karışıyor.
 */
function bumpWeight(delta: number, softness: number): number {
  const sharp = Math.exp(-Math.abs(delta) / SIGMA_SHARP);
  const soft = Math.exp(-0.5 * (delta / SIGMA_SOFT) ** 2);
  return sharp * (1 - softness) + soft * softness;
}

type RingStar = {
  base: number;
  /** -1 arkada, +1 önde. */
  depth: number;
  /** Halka kesiti içindeki yeri, -1..1. */
  band: number;
  size: number;
  phase: number;
  speed: number;
};

type SkyStar = { angle: number; radius: number; depth: number; size: number; phase: number };

const STAR_RGB: [number, number, number] = [226, 232, 240];

// Gökyüzü sabit ve prop'lardan bağımsız — bir kez, modül yüklenirken üretilir.
const RING: RingStar[] = (() => {
  const random = makeRandom(20260731);
  const stars = Array.from({ length: RING_STARS }, (_, i) => {
    // İki bağımsız rastgele sayının ortalaması: derinlik kenarlarda seyrek,
    // ortada yoğun olsun — düz dağılım halkayı içi boş bir boru gibi gösteriyor.
    const depth = random() + random() - 1;
    return {
      base: (i / RING_STARS) * TAU + (random() - 0.5) * 0.014,
      depth,
      band: random() + random() - 1,
      size: 0.4 + random() * 0.9,
      phase: random() * TAU,
      speed: 1.1 + random() * 2.4,
    };
  });
  // Uzaktakiler önce çizilsin ki yakındakiler üstlerine binsin.
  return stars.sort((a, b) => a.depth - b.depth);
})();

const SKY: SkyStar[] = (() => {
  const random = makeRandom(981133);
  return Array.from({ length: SKY_STARS }, () => ({
    angle: random() * TAU,
    // sqrt: köşelere kadar eşit yoğunlukta dağılsın, merkezde yığılmasın.
    radius: 0.04 + Math.sqrt(random()) * 0.66,
    depth: random() + random() - 1,
    size: 0.3 + random() * 0.7,
    phase: random() * TAU,
  }));
})();

export default function StarCompass({ friends, heading, waiting, dimmed }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Animasyon döngüsü her karede en güncel prop'ları buradan okur; böylece
  // prop değiştiğinde döngüyü yeniden kurmaya gerek kalmıyor.
  const propsRef = useRef<Props>({ friends, heading, waiting, dimmed });
  // Yeni veri geldiğinde bir sonraki animasyon karesini beklemeden çiziyoruz.
  // Tarayıcı requestAnimationFrame'i kıstığında (arka plan sekme, güç tasarrufu)
  // kadran bayat kalmasın diye.
  const renderRef = useRef<((now: number) => void) | null>(null);

  useEffect(() => {
    propsRef.current = { friends, heading, waiting, dimmed };
    renderRef.current?.(performance.now());
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let size = 0;
    let frame = 0;
    const start = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      size = rect.width;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.width * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Boyut değişimi tuvali temizler; bir sonraki kareyi beklemeden doldur.
      render(performance.now());
    };

    let lastRender = -1;
    const render = (now: number) => {
      if (size === 0) return;
      // Aynı kare içinde iki kez çizme (hem döngü hem prop değişimi tetikleyebilir).
      if (now - lastRender < 8) return;
      lastRender = now;

      const seconds = reduceMotion ? 0 : (now - start) / 1000;
      const { friends: list, heading: head, waiting: isWaiting, dimmed: isDimmed } =
        propsRef.current;

      const c = size / 2;
      const ringRadius = size * R_RING;
      const base = isDimmed ? 0.28 : 1;

      ctx.clearRect(0, 0, size, size);

      // --- Arkadaşların gökyüzünde açtığı çukurlar ---
      const bumps: Bump[] = [];
      let uniform = 0; // "çok yakın" hâli: yön yok, çemberin tamamı şişer
      let uniformRgb: [number, number, number] | null = null;

      for (const friend of list) {
        if (friend.distanceMeters === null) continue;

        const fade =
          friend.ageMs === null ? 1 : Math.max(0.25, Math.min(1, 1 - friend.ageMs / FADE_MS));
        const t = clamp01(
          Math.log10(Math.max(friend.distanceMeters, NEAR_M) / NEAR_M) /
            Math.log10(FAR_M / NEAR_M),
        );
        const amp = size * (AMP_NEAR * (1 - t) + AMP_FAR * t) * fade;
        const rgb = hexToRgb(friend.color);

        if (friend.bearing === null) {
          // 50 m altında yön ölçülemiyor (GPS gürültüsü). Rastgele bir yöne
          // köşe çıkarmak yalan olurdu — bunun yerine gök her yönden kabarır.
          const swell = size * AMP_NEAR * 0.9 * fade;
          if (swell > uniform) {
            uniform = swell;
            uniformRgb = rgb;
          }
          continue;
        }

        bumps.push({
          angle: ((friend.bearing - (head ?? 0)) * Math.PI) / 180,
          amp,
          softness: t,
          presence: 0.22 + 0.78 * (1 - t),
          rgb,
        });
      }

      // --- Uzaktaki yıldızlar (daha yavaş döner: derinlik hissi) ---
      const skyPhase = seconds * 0.012;
      for (const star of SKY) {
        const a = star.angle - skyPhase;
        const r = star.radius * size;
        const twinkle = 0.26 + 0.24 * Math.sin(seconds * 0.8 + star.phase);
        ctx.globalAlpha = base * twinkle * (0.45 + 0.55 * ((star.depth + 1) / 2));
        ctx.fillStyle = "#c7d2e3";
        ctx.beginPath();
        ctx.arc(
          c + Math.sin(a) * r,
          c - Math.cos(a) * r,
          star.size * (0.7 + 0.6 * ((star.depth + 1) / 2)),
          0,
          TAU,
        );
        ctx.fill();
      }

      // --- Çember: yalnızca yıldızlardan, saat yönünün TERSİNE akar ---
      const ringPhase = seconds * 0.045; // tam tur ~140 sn
      for (const star of RING) {
        const a = star.base - ringPhase;

        let displacement = uniform;
        let strongest = 0;
        let rgb = STAR_RGB;

        if (uniformRgb) rgb = mix(STAR_RGB, uniformRgb, 0.55);

        for (const bump of bumps) {
          const weight = bumpWeight(angleDiff(a, bump.angle), bump.softness);
          displacement += bump.amp * weight;
          // "En güçlü" derken sadece açısal yakınlık değil, arkadaşın ne kadar
          // yakın olduğu da sayılıyor — yoksa 300 km'deki biri kadranı ele geçirir.
          const shout = weight * bump.presence;
          if (shout > strongest) {
            strongest = shout;
            rgb = mix(STAR_RGB, bump.rgb, Math.min(1, shout * 1.25));
          }
        }

        // Halka kesiti + derinlik paralaksı: öndeki yıldız biraz daha dışarıda.
        const r =
          (ringRadius + displacement + star.band * size * BAND) *
          (1 + star.depth * PARALLAX);
        const x = c + Math.sin(a) * r;
        const y = c - Math.cos(a) * r;

        const near = (star.depth + 1) / 2; // 0 arka, 1 ön
        const twinkle = 0.55 + 0.45 * Math.sin(seconds * star.speed + star.phase);
        // Çıkıntıya yakalanan yıldız biraz büyür ve parlar — ama şekli
        // boğmayacak kadar; asıl anlatan şey çemberin bozulması.
        const radius = star.size * (0.6 + 0.75 * near) * (1 + strongest * 0.7);
        const alpha =
          base * Math.min(1, twinkle * (0.42 + 0.52 * near + strongest * 0.6));
        const fill = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;

        ctx.fillStyle = fill;
        ctx.globalAlpha = alpha * 0.16;
        ctx.beginPath();
        ctx.arc(x, y, radius * 2.2, 0, TAU);
        ctx.fill();

        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, TAU);
        ctx.fill();
      }

      // --- Çıkıntının ucundaki yıldız: arkadaşın kendisi ---
      // Akan yıldızlar ucun tam tepesine her an denk gelmiyor, o yüzden sivri
      // ucun parlaklığı sallanıyordu. Buraya sabitlenmiş bir yıldız, en kritik
      // bilgiyi — yönü — her karede okunur tutuyor.
      for (const bump of bumps) {
        const r = ringRadius + bump.amp;
        const x = c + Math.sin(bump.angle) * r;
        const y = c - Math.cos(bump.angle) * r;
        const radius = 1.3 + 2.2 * bump.presence;
        const fill = `rgb(${bump.rgb[0]}, ${bump.rgb[1]}, ${bump.rgb[2]})`;

        ctx.fillStyle = fill;
        ctx.globalAlpha = base * 0.18 * bump.presence;
        ctx.beginPath();
        ctx.arc(x, y, radius * 3.4, 0, TAU);
        ctx.fill();

        ctx.globalAlpha = base * (0.45 + 0.55 * bump.presence);
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, TAU);
        ctx.fill();
      }

      // --- Merkez: sen ---
      const pulse = isWaiting ? 0.5 + 0.5 * Math.sin(seconds * 2.2) : 0;
      if (isWaiting) {
        ctx.globalAlpha = base * (0.35 - pulse * 0.3);
        ctx.strokeStyle = "#e8c37a";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(c, c, size * 0.05 + pulse * size * 0.05, 0, TAU);
        ctx.stroke();
      }

      ctx.fillStyle = "#e8c37a";
      ctx.globalAlpha = base * 0.28;
      ctx.beginPath();
      ctx.arc(c, c, size * 0.022, 0, TAU);
      ctx.fill();

      ctx.globalAlpha = base;
      ctx.beginPath();
      ctx.arc(c, c, size * 0.008, 0, TAU);
      ctx.fill();
    };

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      render(now);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    renderRef.current = render;
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderRef.current = null;
    };
  }, []);

  // Kadranın boyunu eni belirliyor (kare), o yüzden sınırı da ene koyuyoruz:
  // hem kutuya hem ekran yüksekliğine sığsın. 40dvh, iPhone 16 Pro'da başlık,
  // mesafe yazısı, arkadaş listesi ve alt menüden sonra kalan boşluğa oturuyor;
  // daha kısa telefonlarda kadran kendiliğinden küçülüyor.
  return (
    <canvas
      ref={canvasRef}
      className="block aspect-square w-full max-w-[40dvh]"
      aria-hidden="true"
    />
  );
}
