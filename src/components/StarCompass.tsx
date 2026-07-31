"use client";

import { useEffect, useRef } from "react";

/**
 * Gece göğü pusulası.
 *
 * Yıldızlar etrafını saran bir KÜRE kabuğuna dağılmış durumda ve küre saat
 * yönünün tersine dönüyor. Yoğunluk ekvatorda toplandığı için silüet çembere
 * yakın duruyor, ama kutuplara doğru seyrelen yıldızlar hacmi veriyor.
 *
 * Arkadaşın bulunduğu yönde küre dışa doğru sivriliyor — arkadaş yakınsa uzun
 * ve keskin bir köşe, uzaksa hafif ama seçilebilir bir tümsek. "Çekim" ne kadar
 * yakınsa o kadar güçlü.
 *
 * NEDEN KÜRE, YATIK ÇEMBER DEĞİL: küreye tam tepeden bakıyoruz. Bir yıldızın
 * ekran açısı yalnızca kerterizine bağlı, yüksekliğine değil — yükseklik sadece
 * merkeze olan uzaklığı (cos) ve derinliği (sin) belirliyor. Yani hacim
 * bedavaya geliyor, YÖN HİÇ BOZULMUYOR. Çemberi elips gibi yatırsaydık açılar
 * kayardı ve bu uygulamanın tek işi doğru yönü göstermek.
 *
 * Dönme de katı cisim gibi: bütün yıldızlar aynı açısal hızda ilerliyor, ama
 * ekvattakiler geniş yörüngede olduğu için ekranda hızlı, kutba yakınlar yavaş
 * akıyor. Hareket paralaksı buradan kendiliğinden çıkıyor.
 */

export type DialFriend = {
  id: string;
  name: string;
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

const SPHERE_STARS = 540;
const SKY_STARS = 240;

/** Çıkıntı ölçeğinin uçları. */
const NEAR_M = 50;
const FAR_M = 300_000;

const R_SPHERE = 0.28; // kürenin yarıçapı (kenar uzunluğuna oran)
const AMP_NEAR = 0.17; // 50 m'de çıkıntının boyu
const AMP_FAR = 0.022; // 300 km'de çıkıntının boyu
const SIGMA_SHARP = 0.06; // radyan — yakındaki sivri ucun genişliği
const SIGMA_SOFT = 0.3; // radyan — uzaktaki yayvan tümseğin genişliği

/**
 * Yükseklik dağılımının keskinliği. Büyüdükçe yıldızlar ekvatora toplanır,
 * silüet çembere yaklaşır. 1 = küre yüzeyine düzgün dağılım (fazla dolu),
 * 2.6 = "çembere daha yakın küre".
 */
const LATITUDE_BIAS = 3.1;
/** Kabuğun kalınlığı — kürenin yüzeyi tek bir çizgi değil, ince bir katman. */
const SHELL = 0.03;

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
  /** Ekran açısı = kerteriz - pusula yönü (radyan). */
  angle: number;
  name: string;
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

type Star = {
  /** Kerteriz (küre üzerindeki boylam). */
  base: number;
  /** cos(yükseklik) — merkeze olan uzaklık çarpanı. */
  cosLat: number;
  /** sin(yükseklik) — derinlik: +1 tepe (bize yakın), -1 dip (uzak). */
  sinLat: number;
  /** Kabuk kalınlığı içindeki yeri, -1..1. */
  shell: number;
  size: number;
  phase: number;
  speed: number;
};

type SkyStar = { angle: number; radius: number; depth: number; size: number; phase: number };

const STAR_RGB: [number, number, number] = [226, 232, 240];

// Gökyüzü sabit ve prop'lardan bağımsız — bir kez, modül yüklenirken üretilir.
const SPHERE: Star[] = (() => {
  const random = makeRandom(20260731);
  const stars = Array.from({ length: SPHERE_STARS }, () => {
    // Kuvvet alma yüksekliği sıfıra çeker: çoğu yıldız ekvatorda, azalan bir
    // kuyruk kutuplara doğru gider. Düzgün dağılımda küre içi dolu bir top
    // gibi görünüyor, silüetteki çember kayboluyordu.
    const u = random() * 2 - 1;
    const lat = Math.sign(u) * Math.abs(u) ** LATITUDE_BIAS * (Math.PI / 2) * 0.98;
    return {
      base: random() * TAU,
      cosLat: Math.cos(lat),
      sinLat: Math.sin(lat),
      shell: random() + random() - 1,
      size: 0.4 + random() * 0.9,
      phase: random() * TAU,
      speed: 1.1 + random() * 2.4,
    };
  });
  // Yükseklik sabit olduğu için sıralamayı bir kez yapıyoruz: alttakiler önce
  // çizilsin, üsttekiler onların üstüne binsin. Kare başına sıralama yok.
  return stars.sort((a, b) => a.sinLat - b.sinLat);
})();

const SKY: SkyStar[] = (() => {
  const random = makeRandom(981133);
  return Array.from({ length: SKY_STARS }, () => ({
    angle: random() * TAU,
    // sqrt: köşelere kadar eşit yoğunlukta dağılsın, merkezde yığılmasın.
    radius: 0.04 + Math.sqrt(random()) * 0.66,
    depth: random() * 2 - 1,
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
      const sphereRadius = size * R_SPHERE;
      const base = isDimmed ? 0.28 : 1;

      ctx.clearRect(0, 0, size, size);

      // --- Arkadaşların gökyüzünde açtığı çıkıntılar ---
      const bumps: Bump[] = [];
      let uniform = 0; // "çok yakın" hâli: yön yok, kürenin tamamı şişer
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
          // köşe çıkarmak yalan olurdu — bunun yerine küre her yönden kabarır.
          const swell = size * AMP_NEAR * 0.9 * fade;
          if (swell > uniform) {
            uniform = swell;
            uniformRgb = rgb;
          }
          continue;
        }

        bumps.push({
          angle: ((friend.bearing - (head ?? 0)) * Math.PI) / 180,
          name: friend.name,
          amp,
          softness: t,
          presence: 0.22 + 0.78 * (1 - t),
          rgb,
        });
      }

      // --- Uzaktaki yıldızlar: düz gökyüzü, kürenin arkasında ---
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

      // --- Küre: saat yönünün TERSİNE döner ---
      // SPHERE dizisi yüksekliğe göre sıralı olduğu için alttakiler önce
      // çiziliyor, üsttekiler üstlerine biniyor.
      const spin = seconds * 0.045; // tam tur ~140 sn
      for (const star of SPHERE) {
        const theta = star.base - spin;

        let displacement = uniform;
        let strongest = 0;
        let rgb = STAR_RGB;

        if (uniformRgb) rgb = mix(STAR_RGB, uniformRgb, 0.55);

        for (const bump of bumps) {
          const weight = bumpWeight(angleDiff(theta, bump.angle), bump.softness);
          displacement += bump.amp * weight;
          // "En güçlü" derken sadece açısal yakınlık değil, arkadaşın ne kadar
          // yakın olduğu da sayılıyor — yoksa 300 km'deki biri kadranı ele geçirir.
          const shout = weight * bump.presence;
          if (shout > strongest) {
            strongest = shout;
            rgb = mix(STAR_RGB, bump.rgb, Math.min(1, shout * 1.25));
          }
        }

        // Tepeden bakış: ekran yarıçapı yükseklik kosinüsüyle küçülüyor,
        // ekran AÇISI ise yalnızca kerterize bağlı — yön bozulmuyor.
        const r =
          (sphereRadius + displacement) * star.cosLat + star.shell * size * SHELL;
        const x = c + Math.sin(theta) * r;
        const y = c - Math.cos(theta) * r;

        const near = (star.sinLat + 1) / 2; // 0 dip (uzak), 1 tepe (yakın)
        const twinkle = 0.55 + 0.45 * Math.sin(seconds * star.speed + star.phase);
        // Derinlik boyu ve parlaklığı sürüyor; ayrıca ekvattakiler bir tık öne
        // çıkıyor ki silüetteki çember kaybolmasın.
        const radius =
          star.size * (0.4 + 1.2 * near) * (0.6 + 0.4 * star.cosLat) * (1 + strongest * 0.7);
        const alpha =
          base *
          Math.min(
            1,
            twinkle * (0.3 + 0.68 * near + strongest * 0.6) * (0.38 + 0.62 * star.cosLat),
          );
        const fill = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;

        // Alan derinliği: uzaktaki yıldız geniş ve dağınık (odak dışı),
        // öndeki sıkı bir hâle ile keskin bir çekirdek.
        ctx.fillStyle = fill;
        ctx.globalAlpha = alpha * (0.1 + 0.12 * (1 - near));
        ctx.beginPath();
        ctx.arc(x, y, radius * (3.4 - 1.6 * near), 0, TAU);
        ctx.fill();

        ctx.globalAlpha = alpha * (0.3 + 0.7 * near);
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, TAU);
        ctx.fill();
      }

      // --- Çıkıntının ucundaki yıldız: arkadaşın kendisi ---
      // Akan yıldızlar ucun tam tepesine her an denk gelmiyor, o yüzden sivri
      // ucun parlaklığı sallanıyordu. Ekvatora sabitlenmiş bu yıldız, en kritik
      // bilgiyi — yönü — her karede okunur tutuyor.
      // Tek arkadaş varsa isim yazmıyoruz — kimin olduğu zaten kürenin altındaki
      // yazıda duruyor, kadranı gereksiz kalabalıklaştırmanın anlamı yok.
      const showNames = bumps.length > 1;

      for (const bump of bumps) {
        const r = sphereRadius + bump.amp;
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

        if (!showNames) continue;

        const label = bump.name.length > 12 ? `${bump.name.slice(0, 11)}…` : bump.name;
        const fontSize = Math.max(10, size * 0.033);
        ctx.font = `500 ${fontSize}px var(--font-geist-sans), system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Etiket yıldızın dışına itiliyor. Kaçış payına metnin kendi yarısı da
        // ekleniyor: yatay yönlerde sadece sabit bir boşluk bırakınca yazı geri
        // gelip yıldızın üstüne biniyor. Sonra tuvalin içinde kalacak şekilde
        // kıstırılıyor — kuzeydeki uzun bir çıkıntıda yazı üstten taşabiliyor.
        const width = ctx.measureText(label).width;
        const dx = Math.sin(bump.angle);
        const dy = -Math.cos(bump.angle);
        const gap = radius + 5;
        const pad = 3;
        const lx = Math.min(
          size - width / 2 - pad,
          Math.max(width / 2 + pad, x + dx * (gap + (width / 2) * Math.abs(dx))),
        );
        const ly = Math.min(
          size - fontSize / 2 - pad,
          Math.max(fontSize / 2 + pad, y + dy * (gap + (fontSize / 2) * Math.abs(dy))),
        );

        // Yıldızların üstünde okunabilsin diye koyu bir kontur.
        ctx.globalAlpha = base * 0.85;
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#05060b";
        ctx.strokeText(label, lx, ly);

        ctx.globalAlpha = base * (0.55 + 0.45 * bump.presence);
        ctx.fillStyle = fill;
        ctx.fillText(label, lx, ly);
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
