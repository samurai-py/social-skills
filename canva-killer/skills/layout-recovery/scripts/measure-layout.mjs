#!/usr/bin/env node
// layout-recovery skill helper — measures a reference design instead of guessing its geometry.
//
//   node measure-layout.mjs <image> [--overlay out.png] [--canvas 1080x1350] [--json out.json]
//
// Vision models are good at "what is this" and bad at "where exactly is it, in pixels". This
// script does the pixel part deterministically:
//   - canvas size + nearest standard format (post/portrait/story/cover) and the scale factor to it
//   - background color (border ring) and whether the reference is photo-like
//   - content bounding box -> real margins (px and %)
//   - horizontal BANDS of content (rows separated by vertical whitespace) split into BLOCKS by
//     horizontal gaps; each block gets bbox (px, %, and in --canvas units), dominant color, and for
//     text-like blocks an estimated line count / line pitch / font-size
//   - --overlay: the reference with a labeled 10% grid and numbered block boxes drawn on top —
//     read positions off THAT image, then write the template CSS from the numbers below.
// Estimates are starting points for the closed-loop QA, not final values.

import fs from 'node:fs';
import path from 'node:path';
import {
  loadImage, toDataUri, pixels, clusterColors, detectBackground, oklab, deltaE, shotHtml, SHEET_CSS, parseArgs,
} from '../../brand-identity/scripts/_lib.mjs';

const { pos: [file], opts } = parseArgs(process.argv.slice(2));
if (!file || !fs.existsSync(file)) { console.error('Usage: node measure-layout.mjs <image> [--overlay out.png] [--canvas WxH] [--json out.json]'); process.exit(1); }

const img = await loadImage(file, 540);
const { W, H, small, k } = img;
const w = small.bitmap.width, h = small.bitmap.height;
const STD = [['post', 1080, 1080], ['portrait', 1080, 1350], ['story', 1080, 1920], ['cover', 1200, 630]];
const ar = W / H;
const std = STD.map(([n, cw, ch]) => ({ name: n, w: cw, h: ch, diff: Math.abs(cw / ch - ar) })).sort((a, b) => a.diff - b.diff)[0];
const canvas = opts.canvas ? opts.canvas.split('x').map(Number) : [std.w, std.h];
const scale = canvas[0] / W; // reference px -> canvas px

// ---- background + content mask ----
const bgInfo = detectBackground(small);
const bg = bgInfo.cluster;
const bgLab = bg.lab;
const TH = 0.09; // OKLab distance from bg to count as content
const mask = new Uint8Array(w * h);
const { data } = small.bitmap;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const i = (y * w + x) * 4;
  if (data[i + 3] < 128) continue;
  if (deltaE(oklab(data[i], data[i + 1], data[i + 2]), bgLab) > TH) mask[y * w + x] = 1;
}
const rowFill = new Float32Array(h), colFill = new Float32Array(w);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) { rowFill[y]++; colFill[x]++; }
for (let y = 0; y < h; y++) rowFill[y] /= w;
for (let x = 0; x < w; x++) colFill[x] /= h;
const contentShare = mask.reduce((a, b) => a + b, 0) / (w * h);

// ---- content bbox / margins ----
const first = (arr, th) => arr.findIndex((v) => v > th);
const last = (arr, th) => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i] > th) return i; return -1; };
const cx0 = first(colFill, 0.004), cx1 = last(colFill, 0.004), cy0 = first(rowFill, 0.004), cy1 = last(rowFill, 0.004);
const px = (v) => Math.round(v / k);
const pct = (v, total) => +((v / total) * 100).toFixed(1);
const bbox = cx0 < 0 ? null : { x: px(cx0), y: px(cy0), w: px(cx1 - cx0 + 1), h: px(cy1 - cy0 + 1) };
const margins = bbox ? { left: bbox.x, top: bbox.y, right: W - bbox.x - bbox.w, bottom: H - bbox.y - bbox.h } : null;

// ---- bands (rows of content) ----
function segments(fill, minGap, th) {
  const segs = []; let start = -1, gap = 0;
  for (let i = 0; i < fill.length; i++) {
    if (fill[i] > th) { if (start < 0) start = i; gap = 0; }
    else if (start >= 0) { gap++; if (gap >= minGap) { segs.push([start, i - gap]); start = -1; gap = 0; } }
  }
  if (start >= 0) segs.push([start, fill.length - 1 - gap]);
  return segs;
}
const bands = segments(rowFill, Math.max(3, Math.round(h * 0.012)), 0.003);
const blocks = [];
for (const [y0, y1] of bands) {
  const cf = new Float32Array(w);
  for (let y = y0; y <= y1; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) cf[x]++;
  for (let x = 0; x < w; x++) cf[x] /= (y1 - y0 + 1);
  for (const [x0, x1] of segments(cf, Math.max(4, Math.round(w * 0.045)), 0.02)) {
    // per-block stats: dominant non-bg color, line structure
    const sub = clusterColors((function* () {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (mask[y * w + x]) { const i = (y * w + x) * 4; yield [data[i], data[i + 1], data[i + 2]]; }
    })(), { merge: 0.06 });
    const rf = [];
    for (let y = y0; y <= y1; y++) { let c = 0; for (let x = x0; x <= x1; x++) c += mask[y * w + x]; rf.push(c / (x1 - x0 + 1)); }
    const lines = segments(Float32Array.from(rf), 1, 0.01);
    const bh = y1 - y0 + 1, bw = x1 - x0 + 1;
    const fillRatio = rf.reduce((a, b) => a + b, 0) / bh;
    const solid = fillRatio > 0.85; // panel / photo / bar
    const pitch = lines.length > 1 ? (lines[lines.length - 1][0] - lines[0][0]) / (lines.length - 1) : null;
    const lineH = lines.length ? lines.reduce((a, [a0, a1]) => a + (a1 - a0 + 1), 0) / lines.length : bh;
    const kind = solid ? (bw / w > 0.9 && bh / h > 0.3 ? 'panel/photo' : bh / w < 0.02 ? 'bar/rule' : 'panel/photo')
      : lines.length >= 2 && pitch && pitch < bh ? 'text (multi-line)' : bh / h < 0.12 ? 'text/inline' : 'graphic';
    // single line: glyph box (ascender..descender) ≈ 0.9em; multi-line: pitch ≈ 1.15em (typical line-height)
    const fontPx = !solid ? Math.round((pitch ? pitch / 1.15 : lineH / 0.9) / k) : null;
    blocks.push({
      n: blocks.length + 1, kind,
      px: { x: px(x0), y: px(y0), w: px(bw), h: px(bh) },
      pct: { x: pct(x0, w), y: pct(y0, h), w: pct(bw, w), h: pct(bh, h) },
      canvas: { x: Math.round(px(x0) * scale), y: Math.round(px(y0) * scale), w: Math.round(px(bw) * scale), h: Math.round(px(bh) * scale) },
      color: sub[0]?.hex, color2: sub[1]?.hex,
      ...(fontPx ? { lines: lines.length, linePitchPx: pitch ? Math.round(pitch / k) : null, fontSizePx: fontPx, fontSizeCanvas: Math.round(fontPx * scale) } : {}),
    });
  }
}

const result = {
  file, size: `${W}x${H}`, aspect: +ar.toFixed(3),
  nearestFormat: `${std.name} ${std.w}x${std.h}`, canvas: `${canvas[0]}x${canvas[1]}`, scaleToCanvas: +scale.toFixed(4),
  background: { hex: bg.hex, borderShare: +bgInfo.share.toFixed(2), photoLike: bgInfo.photoLike },
  contentSharePct: +(contentShare * 100).toFixed(1),
  contentBbox: bbox, margins, marginsPct: margins ? { left: pct(margins.left, W), top: pct(margins.top, H), right: pct(margins.right, W), bottom: pct(margins.bottom, H) } : null,
  blocks,
  notes: [
    bgInfo.photoLike ? 'photo-like reference: bands/blocks are unreliable where the photo is; use the overlay grid for positions instead.' : null,
    'fontSizePx is an estimate from line pitch (÷1.15) or glyph box height (÷0.9); confirm in the QA render.',
    `canvas coordinates = reference px × ${scale.toFixed(4)} (target ${canvas[0]}x${canvas[1]}).`,
  ].filter(Boolean),
};

if (opts.overlay) {
  const uri = await toDataUri(img.im, 1080);
  const dw = Math.min(1080, W), dh = Math.round(dw * (H / W)), s = dw / W;
  const grid = [10, 20, 30, 40, 50, 60, 70, 80, 90].map((p) => `<div style="position:absolute;left:${p}%;top:0;bottom:0;border-left:1px dashed rgba(255,255,255,.35)"></div><div style="position:absolute;top:${p}%;left:0;right:0;border-top:1px dashed rgba(255,255,255,.35)"></div><span style="position:absolute;left:${p}%;top:2px;color:#fff;background:#000a;padding:0 3px;font-size:10px">${p}%</span><span style="position:absolute;top:${p}%;left:2px;color:#fff;background:#000a;padding:0 3px;font-size:10px">${p}%</span>`).join('');
  const boxes = blocks.map((b) => `<div style="position:absolute;left:${b.px.x * s}px;top:${b.px.y * s}px;width:${b.px.w * s}px;height:${b.px.h * s}px;border:2px solid #ff3b9a;box-shadow:0 0 0 1px #000"><span style="position:absolute;left:-2px;top:-18px;background:#ff3b9a;color:#000;font-weight:700;padding:0 5px;font-size:11px">${b.n}</span></div>`).join('');
  const legend = blocks.map((b) => `<div><b>${b.n}</b> ${b.kind} · xywh ${b.px.x},${b.px.y} ${b.px.w}×${b.px.h} (${b.pct.x}%,${b.pct.y}% ${b.pct.w}%×${b.pct.h}%)${b.fontSizePx ? ` · ~${b.fontSizePx}px · ${b.lines} line(s)` : ''} · ${b.color}</div>`).join('');
  const html = `<!doctype html><meta charset="utf-8"><style>${SHEET_CSS} .ov{position:relative;width:${dw}px;height:${dh}px;background:url(${uri}) 0 0/100% 100%} .lg{margin-top:10px;line-height:1.6;max-width:${dw}px}</style>
  <div id="sheet"><div class="ov">${grid}${boxes}</div><div class="lg"><div class="m">${W}×${H} · bg ${bg.hex} · margins L${margins?.left} T${margins?.top} R${margins?.right} B${margins?.bottom}px</div>${legend}</div></div>`;
  result.overlay = await shotHtml(html, opts.overlay, { width: dw + 60, height: dh + 400 });
}
if (opts.json) fs.writeFileSync(opts.json, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
