// Génère les icônes PNG de l'application sans dépendance (dessin vectoriel simple + zlib).
// Usage : npm run icons
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const S = 4; // suréchantillonnage pour l'anticrénelage
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++)
        for (let sx = 0; sx < S; sx++) {
          const [pr, pg, pb, pa] = pixel((x + (sx + 0.5) / S) / size, (y + (sy + 0.5) / S) / size);
          r += pr * pa; g += pg * pa; b += pb * pa; a += pa;
        }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = a ? Math.round(r / a) : 0;
      raw[o + 1] = a ? Math.round(g / a) : 0;
      raw[o + 2] = a ? Math.round(b / a) : 0;
      raw[o + 3] = Math.round((a / (S * S)) * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (c1, c2, t) => c1.map((v, i) => Math.round(v + (c2[i] - v) * t));
const TOP = hex('#CFE0CB'), BOTTOM = hex('#F6DCD9'), CREAM = hex('#FBF8F3'), SAGE = hex('#5F7F5C'), PEACH = hex('#F3C6A8');

// Feuille : intersection de deux disques, inclinée à 45°.
function leaf(u, v, scale) {
  const c = Math.SQRT1_2;
  const x = (u * c + v * c) / scale, y = (-u * c + v * c) / scale;
  const L = 0.5;
  const inLeaf = Math.abs(x) < L && Math.abs(y) < 0.24 * (1 - (x / L) ** 2);
  const rib = Math.abs(y) < 0.022 && x > -0.36 && x < 0.3;
  return { inLeaf, rib };
}

function icon(pad) {
  return (fx, fy) => {
    let col = mix(TOP, BOTTOM, fy);
    const u = (fx - 0.5) / (1 - 2 * pad), v = (fy - 0.5) / (1 - 2 * pad);
    if (Math.hypot(u, v) < 0.36) col = CREAM;
    if (Math.hypot(u - 0.24, v + 0.24) < 0.085) col = PEACH;
    const l = leaf(u, v + 0.01, 0.42);
    if (l.inLeaf) col = l.rib ? CREAM : SAGE;
    return [...col, 1];
  };
}
const badge = (fx, fy) => {
  const l = leaf(fx - 0.5, fy - 0.5, 0.9);
  return l.inLeaf && !l.rib ? [255, 255, 255, 1] : [0, 0, 0, 0];
};

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', png(192, icon(0)));
writeFileSync('public/icons/icon-512.png', png(512, icon(0)));
writeFileSync('public/icons/icon-maskable-512.png', png(512, icon(0.1)));
writeFileSync('public/icons/apple-touch-icon.png', png(180, icon(0)));
writeFileSync('public/icons/badge-96.png', png(96, badge));
writeFileSync('public/favicon.png', png(64, icon(0)));
console.log('Icônes générées dans public/icons');
