// Shared helpers for the identity/layout scripts (extract-palette, compare, measure-layout).
// Perceptual color math (OKLab), image loading + clustering, background detection, and a
// tiny "render this HTML to a PNG" helper so scripts can emit contact sheets / overlays that a
// vision model reads far more reliably than raw numbers.

import fs from 'node:fs';
import path from 'node:path';
import { Jimp } from 'jimp';
import { chromium } from 'playwright-core';

// ---------- color math ----------
export const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const parseHex = (h) => {
  const m = String(h).trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let s = m[1];
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
// sRGB -> OKLab (Björn Ottosson). L 0..1, a/b roughly -0.4..0.4. Euclidean distance here is a
// good perceptual difference: ~0.02 is barely noticeable, ~0.1 is clearly a different color.
export function oklab(r, g, b) {
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
export const deltaE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const chromaOk = (lab) => Math.hypot(lab[1], lab[2]);
export const hueOk = (lab) => { const h = (Math.atan2(lab[2], lab[1]) * 180) / Math.PI; return h < 0 ? h + 360 : h; };
export const hueDiff = (h1, h2) => { const d = Math.abs(h1 - h2) % 360; return d > 180 ? 360 - d : d; };
export const luminance = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
// WCAG contrast ratio between two [r,g,b]
export function contrast(c1, c2) {
  const l1 = luminance(...c1), l2 = luminance(...c2);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
export const mix = (c1, c2, t) => c1.map((v, i) => v + (c2[i] - v) * t);

// ---------- images ----------
export async function loadImage(file, maxSide = 200) {
  const im = await Jimp.read(file);
  const { width: W, height: H } = im.bitmap;
  const k = Math.min(1, maxSide / Math.max(W, H));
  const small = k < 1 ? im.clone().resize({ w: Math.max(1, Math.round(W * k)), h: Math.max(1, Math.round(H * k)) }) : im.clone();
  return { file, W, H, im, small, k };
}
export async function toDataUri(im, maxSide = 900) {
  const { width: W, height: H } = im.bitmap;
  const k = Math.min(1, maxSide / Math.max(W, H));
  const s = k < 1 ? im.clone().resize({ w: Math.round(W * k), h: Math.round(H * k) }) : im;
  return 'data:image/png;base64,' + (await s.getBuffer('image/png')).toString('base64');
}

// Iterate opaque pixels of a Jimp bitmap. `ring` (0..0.5) restricts to the outer border band.
export function* pixels(im, { ring = 0, inner = false } = {}) {
  const { width: w, height: h, data } = im.bitmap;
  const rx = Math.round(w * ring), ry = Math.round(h * ring);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const onRing = x < rx || y < ry || x >= w - rx || y >= h - ry;
      if (ring && (inner ? onRing : !onRing)) continue;
      const i = (y * w + x) * 4;
      if (data[i + 3] < 128) continue;
      yield [data[i], data[i + 1], data[i + 2], x, y];
    }
  }
}

// Perceptual clustering: quantize (STEP levels/channel) then agglomerate buckets whose OKLab
// centroids sit within `merge` of each other. Returns clusters sorted by weight (0..1 share of
// the pixels seen), each with rgb, hex, lab, chroma, hue, L.
export function clusterColors(pixelIter, { step = 8, merge = 0.045 } = {}) {
  const buckets = new Map();
  let n = 0;
  for (const [r, g, b] of pixelIter) {
    const key = ((Math.round(r / step) * step) << 16) | ((Math.round(g / step) * step) << 8) | (Math.round(b / step) * step);
    buckets.set(key, (buckets.get(key) || 0) + 1);
    n++;
  }
  const items = [...buckets.entries()].map(([key, c]) => ({ rgb: [(key >> 16) & 255, (key >> 8) & 255, key & 255], c }))
    .sort((a, b) => b.c - a.c);
  const clusters = [];
  for (const it of items) {
    const lab = oklab(...it.rgb);
    let best = null, bd = Infinity;
    for (const cl of clusters) { const d = deltaE(lab, cl.lab); if (d < bd) { bd = d; best = cl; } }
    if (best && bd < merge) {
      const t = it.c / (best.c + it.c);
      best.rgb = mix(best.rgb, it.rgb, t); best.lab = oklab(...best.rgb); best.c += it.c;
      // peak = most chromatic member with real presence (>= 4% of the cluster leader) — the
      // saturated core of a logo/CTA, before antialiasing halos dull the mean
      if (chromaOk(lab) > chromaOk(best.peakLab) && it.c >= best.peakMin) { best.peak = it.rgb; best.peakLab = lab; }
    } else clusters.push({ rgb: it.rgb, lab, c: it.c, peak: it.rgb, peakLab: lab, peakMin: Math.max(1, it.c * 0.04) });
  }
  return finalize(clusters, n || 1);
}
export function finalize(clusters, n) {
  return clusters.map((cl) => ({
    hex: hex(...cl.rgb), rgb: cl.rgb.map(Math.round), lab: cl.lab, weight: cl.c / n,
    L: cl.lab[0], chroma: chromaOk(cl.lab), hue: hueOk(cl.lab), count: cl.c,
    peak: cl.peak ? { hex: hex(...cl.peak), rgb: cl.peak.map(Math.round), lab: cl.peakLab, chroma: chromaOk(cl.peakLab) } : null,
  })).sort((a, b) => b.weight - a.weight);
}
// Merge cluster lists coming from several images; `images` = in how many sources it recurs.
export function mergeAcross(lists, merge = 0.06) {
  const out = [];
  let total = 0;
  lists.forEach((list, idx) => {
    const n = list.reduce((a, c) => a + c.count, 0) || 1;
    total += 1;
    for (const c of list) {
      const w = c.count / n; // normalize each image to weight 1 regardless of its pixel count
      let best = null, bd = Infinity;
      for (const o of out) { const d = deltaE(c.lab, o.lab); if (d < bd) { bd = d; best = o; } }
      if (best && bd < merge) {
        const t = w / (best.c + w);
        best.rgb = mix(best.rgb, c.rgb, t); best.lab = oklab(...best.rgb); best.c += w; best.srcs.add(idx);
        if (c.peak && c.peak.chroma > chromaOk(best.peakLab)) { best.peak = c.peak.rgb; best.peakLab = c.peak.lab; }
      } else out.push({ rgb: c.rgb, lab: c.lab, c: w, srcs: new Set([idx]), peak: c.peak ? c.peak.rgb : c.rgb, peakLab: c.peak ? c.peak.lab : c.lab });
    }
  });
  return finalize(out, total).map((c, i) => ({ ...c, images: out.sort((a, b) => b.c - a.c)[i].srcs.size }));
}

// Background = dominant color of the outer border ring. Returns { cluster, share, photoLike }.
// `share` = fraction of the ring the winner covers; a low share means the edges are busy
// (photo, gradient) and the caller should treat "bg" with suspicion.
export function detectBackground(small) {
  const ring = clusterColors(pixels(small, { ring: 0.06, inner: true }), { merge: 0.05 });
  const top = ring[0];
  return { cluster: top, share: top ? top.weight : 0, photoLike: !top || top.weight < 0.4 };
}

// ---------- HTML -> PNG ----------
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
export async function shotHtml(html, out, { width = 1200, height = 800, selector = '#sheet' } = {}) {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle' });
    const el = await page.$(selector);
    const box = el ? await el.boundingBox() : { x: 0, y: 0, width, height };
    await page.setViewportSize({ width: Math.ceil(box.x + box.width), height: Math.ceil(box.y + box.height) });
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    await page.screenshot({ path: out, clip: box });
    return path.resolve(out);
  } finally {
    await browser.close();
  }
}
export const SHEET_CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0a0a0a;color:#f2f2ee;font:12px ui-monospace,SFMono-Regular,Menlo,monospace}
  #sheet{display:inline-block;padding:20px;background:#0a0a0a}
  h2{font-size:12px;letter-spacing:2px;color:#7c7c76;text-transform:uppercase;margin:18px 0 8px}
  .row{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start}
  .sw{width:120px}.sw .c{height:64px;border-radius:6px;border:1px solid #262624}
  .sw .t{margin-top:4px;line-height:1.4}.sw .role{font-weight:700;color:#f2f2ee}.sw .m{color:#7c7c76}
  .warn{color:#ffb454;line-height:1.5;margin-top:6px;max-width:900px}
  .thumb{max-width:420px;max-height:420px;border:1px solid #262624;border-radius:6px}
  .pair{display:flex;gap:16px;align-items:flex-start}
`;

// CLI arg helpers
export function parseArgs(argv) {
  const pos = [], opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const v = argv[i + 1]; if (v && !v.startsWith('--')) { opts[k] = v; i++; } else opts[k] = true; }
    else pos.push(a);
  }
  return { pos, opts };
}
