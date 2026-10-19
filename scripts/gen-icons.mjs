// Génère le badge PNG des notifications sans dépendance (dessin vectoriel simple + zlib).
// Usage : npm run icons ; les icônes de l'app : python scripts/icons-from-drawing.py
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
// Fond bleu clair, bouquet de légumes en aplats (dessin original, style à plat de l'app).
const SKY = hex('#B7D0E6');
const TOMATO = hex('#E84B35'), TOMATO_HI = hex('#F58A70'), GREEN = hex('#2F6B3A'), CUKE = hex('#6E9E4A'), CUKE_LINE = hex('#A9C97A');
const CARROT = hex('#F08A3C'), CARROT_LINE = hex('#F7B27A'), CHARD = hex('#4F8A3C'), CHARD_RIB = hex('#C9DE8E');
const ONION = hex('#F4B6C8'), ONION_LINE = hex('#E07A9B');

// Point dans un polygone (règle pair-impair).
function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// Coordonnées dans le repère d'un objet tourné (u le long de l'axe, v en travers).
const local = (x, y, cx, cy, rot) => {
  const c = Math.cos(rot), s = Math.sin(rot), dx = x - cx, dy = y - cy;
  return [dx * c + dy * s, -dx * s + dy * c];
};
const inEllipse = (x, y, cx, cy, rx, ry, rot = 0) => {
  const [u, v] = local(x, y, cx, cy, rot);
  return (u / rx) ** 2 + (v / ry) ** 2 < 1;
};
// Étoile à 5 branches (pédoncules des tomates).
function star(cx, cy, R, r) {
  return Array.from({ length: 10 }, (_, k) => {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rad = k % 2 ? r : R;
    return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
  });
}
const BIG = { c: [0.08, 0.2], r: 0.2 };
const CHERRIES = [[-0.2, -0.27, 0.085], [-0.04, -0.33, 0.075]];
const STEMS = [star(BIG.c[0], BIG.c[1] - BIG.r + 0.03, 0.08, 0.03), ...CHERRIES.map(([cx, cy, r]) => star(cx, cy - r + 0.015, 0.04, 0.016))];

function icon(pad) {
  return (fx, fy) => {
    const k = 1.1 / (1 - 2 * pad);
    const x = (fx - 0.5) * k, y = (fy - 0.5) * k;
    let col = SKY;
    // Feuille de blette à gauche
    if (inEllipse(x, y, -0.24, 0.0, 0.11, 0.24, -0.35)) {
      col = CHARD;
      const [u, v] = local(x, y, -0.24, 0.0, Math.PI / 2 - 0.35);
      if (Math.abs(v) < 0.012 || (Math.abs(Math.abs(v) - Math.abs(u) * 0.0) < 0.01 && false)) col = CHARD_RIB;
    }
    // Courgette en diagonale (haut droite → bas gauche)
    const CK = [0.08, -0.05, -0.85];
    if (inEllipse(x, y, CK[0], CK[1], 0.36, 0.085, CK[2])) {
      col = CUKE;
      const [, v] = local(x, y, CK[0], CK[1], CK[2]);
      if (Math.abs(v - 0.03) < 0.008 || Math.abs(v + 0.025) < 0.008) col = CUKE_LINE;
    }
    // Carotte en diagonale (bas gauche → haut droite), fanes en haut
    const CA = [-0.02, 0.0, 0.85];
    const [cu, cv] = local(x, y, CA[0], CA[1], -CA[2]);
    if (cu > -0.34 && cu < 0.3 && Math.abs(cv) < 0.075 * ((cu + 0.34) / 0.64)) {
      col = CARROT;
      if (Math.abs(((cu * 14) % 1 + 1) % 1 - 0.5) < 0.04 && Math.abs(cv) < 0.04) col = CARROT_LINE;
    }
    if (cu >= 0.29 && cu < 0.46 && [-0.45, 0, 0.45].some((t) => Math.abs(cv - (cu - 0.29) * t) < 0.011)) col = GREEN; // fanes en trois brins
    // Oignon rose en bas à gauche
    if (inEllipse(x, y, -0.2, 0.25, 0.14, 0.12)) {
      col = ONION;
      const [u] = local(x, y, -0.2, 0.25, 0);
      if (Math.abs(Math.abs(u) - 0.06) < 0.008 || Math.abs(u) < 0.006) col = ONION_LINE;
    }
    // Tomates cerises en haut, grosse tomate devant
    for (const [cx, cy, r] of CHERRIES) if (Math.hypot(x - cx, y - cy) < r) col = Math.hypot(x - cx + r * 0.4, y - cy + r * 0.35) < r * 0.18 ? TOMATO_HI : TOMATO;
    if (inEllipse(x, y, BIG.c[0], BIG.c[1], BIG.r * 1.12, BIG.r)) col = inEllipse(x, y, BIG.c[0] - 0.1, BIG.c[1] - 0.06, 0.035, 0.02, -0.5) ? TOMATO_HI : TOMATO;
    if (STEMS.some((st) => inPoly(x, y, st))) col = GREEN;
    return [...col, 1];
  };
}

// Badge des notifications (une seule couleur) : silhouette de tomate.
const BADGE_STEM = star(0.5, 0.2, 0.17, 0.07);
const badge = (fx, fy) => (Math.hypot(fx - 0.5, fy - 0.56) < 0.36 || inPoly(fx, fy, BADGE_STEM) ? [255, 255, 255, 1] : [0, 0, 0, 0]);

mkdirSync('public/icons', { recursive: true });
// Les icônes de l'app viennent du dessin de Camille : voir scripts/icons-from-drawing.py.
// Ce script ne génère plus que le badge des notifications (une seule couleur, exigé par les plateformes).
writeFileSync('public/icons/badge-96.png', png(96, badge));
console.log('Badge des notifications généré dans public/icons');
