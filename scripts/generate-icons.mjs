// Bağımlılıksız PNG ikon üretici: koyu zemin, pirinç halka, pusula ibresi.
// Node'un yerleşik zlib'iyle IDAT sıkıştırır, başka hiçbir şeye ihtiyaç duymaz.
// Çalıştır: npm run icons
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

const BG = [12, 10, 9]; // stone-950
const BRASS = [216, 169, 78]; // ibrenin kuzey ucu
const DIM = [120, 113, 108]; // ibrenin güney ucu
const RING = [64, 56, 48];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** Baryzentrik işaret testi. */
function inTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function makePng(size) {
  const raw = Buffer.alloc(size * (1 + size * 4));
  const c = size / 2;
  const ringRadius = size * 0.40;
  const ringWidth = size * 0.016;
  const tip = size * 0.30;
  const waist = size * 0.085;

  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 4);
    raw[rowStart] = 0; // filtre: yok
    for (let x = 0; x < size; x++) {
      // Piksel merkezleri, kenarlar simetrik olsun diye
      const px = x + 0.5;
      const py = y + 0.5;
      const distance = Math.hypot(px - c, py - c);

      let color = BG;
      if (Math.abs(distance - ringRadius) <= ringWidth) {
        color = RING;
      }
      if (inTriangle(px, py, c, c - tip, c - waist, c, c + waist, c)) {
        color = BRASS;
      } else if (inTriangle(px, py, c, c + tip, c - waist, c, c + waist, c)) {
        color = DIM;
      }

      const off = rowStart + 1 + x * 4;
      raw[off] = color[0];
      raw[off + 1] = color[1];
      raw[off + 2] = color[2];
      raw[off + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit derinliği
  ihdr[9] = 6; // renk tipi: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const targets = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
];

for (const target of targets) {
  writeFileSync(path.join(outDir, target.file), makePng(target.size));
  console.log(`wrote ${target.file}`);
}
