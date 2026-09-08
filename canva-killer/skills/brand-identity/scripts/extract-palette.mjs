#!/usr/bin/env node
// brand-identity skill helper — deterministic palette extraction from one or MORE reference images.
//
//   node extract-palette.mjs <image> [<image> ...] [--sheet out.png] [--json out.json]
//
// What it does (all deterministic, no eyeballing):
//   1. Clusters colors perceptually (OKLab) per image, then reconciles across images: a color that
//      recurs in several references is the brand's color; a one-off is content noise.
//   2. Detects the background from the outer border ring (not "most frequent pixel", which a photo
//      hijacks), and flags photo-like references whose edges are busy.
//   3. Assigns roles: bg / surface / text / muted / accent / accent2 — with WCAG contrast checks.
//      A role that no real cluster can fill is DERIVED (mixed from bg/text) and listed under
//      `derived`, so the agent knows which values are measured and which are fallbacks.
//   4. Optionally renders a contact sheet PNG (--sheet): the references next to the role swatches
//      and every cluster with its share. Look at that image — it's the fastest sanity check.
//
// `roles` is a strong starting point, not gospel: confirm accent is the CTA/logo color and not an
// incidental object, and prefer references that are brand material (site, banner, guideline page).

import fs from 'node:fs';
import path from 'node:path';
import {
  loadImage, toDataUri, pixels, clusterColors, mergeAcross, detectBackground,
  contrast, deltaE, hueDiff, mix, hex, oklab, shotHtml, SHEET_CSS, parseArgs,
} from './_lib.mjs';

const { pos: files, opts } = parseArgs(process.argv.slice(2));
if (!files.length) {
  console.error('Usage: node extract-palette.mjs <image> [<image> ...] [--sheet out.png] [--json out.json]');
  process.exit(1);
}

const warnings = [], derived = [];
const imgs = [];
for (const f of files) {
  if (!fs.existsSync(f)) { console.error(`not found: ${f}`); process.exit(1); }
  imgs.push(await loadImage(f, 420)); // 420px: small UI text (a red label on a site screenshot) survives the downscale
}

// per-image clusters + background votes
const perImage = imgs.map((im) => ({ ...im, clusters: clusterColors(pixels(im.small)), bg: detectBackground(im.small) }));
const clusters = mergeAcross(perImage.map((p) => p.clusters));
perImage.forEach((p) => { if (p.bg.photoLike) warnings.push(`${path.basename(p.file)}: busy edges (photo/gradient) — its background vote is weak; prefer a flat brand surface as reference.`); });

// ---- bg: the border-ring winner shared by most images (weighted by ring share) ----
const bgVotes = [];
for (const p of perImage) {
  if (!p.bg.cluster) continue;
  const v = bgVotes.find((x) => deltaE(x.lab, p.bg.cluster.lab) < 0.08);
  if (v) { v.score += p.bg.share; v.n++; } else bgVotes.push({ ...p.bg.cluster, score: p.bg.share, n: 1 });
}
bgVotes.sort((a, b) => b.score - a.score);
const bg = bgVotes[0] || clusters[0];
const isDark = bg.L < 0.5;
const near = (c, ref, d) => deltaE(c.lab, ref.lab) < d;

// ---- text: best-contrast low-chroma cluster with real presence; else derived ----
const textCands = clusters.filter((c) => c.weight >= 0.004 && c.chroma < 0.12 && !near(c, bg, 0.15));
let text = textCands.sort((a, b) => contrast(b.rgb, bg.rgb) - contrast(a.rgb, bg.rgb))[0];
if (!text || contrast(text.rgb, bg.rgb) < 4.5) {
  const rgb = isDark ? [242, 242, 238] : [17, 17, 17];
  if (text) warnings.push(`text candidate ${text.hex} only reaches ${contrast(text.rgb, bg.rgb).toFixed(1)}:1 on bg — replaced by a derived value.`);
  text = { hex: hex(...rgb), rgb, lab: oklab(...rgb), chroma: 0, weight: 0, derivedFrom: 'bg luminance' };
  derived.push('text');
}

// ---- surface: a low-chroma neighbor of bg (card/panel tone); else derived ----
let surface = clusters.find((c) => c.weight >= 0.015 && c.chroma < 0.08 && !near(c, bg, 0.035) && deltaE(c.lab, bg.lab) < 0.22
  && !near(c, text, 0.15));
if (!surface) {
  const rgb = mix(bg.rgb, isDark ? [255, 255, 255] : [0, 0, 0], 0.06).map(Math.round);
  surface = { hex: hex(...rgb), rgb, lab: oklab(...rgb), weight: 0, derivedFrom: 'bg ±6%' };
  derived.push('surface');
}

// ---- accent / accent2: vivid clusters anywhere in the image, ranked by chroma then weight ----
const vch = (c) => (c.peak ? Math.max(c.chroma, c.peak.chroma) : c.chroma);
const score = (c) => vch(c) * Math.log1p(c.weight * 400) * (c.images / imgs.length) ** 2;
const vivid = clusters.filter((c) => vch(c) >= 0.09 && c.weight >= 0.0005 && !near(c, bg, 0.1) && !near(c, text, 0.1)
  && contrast(c.rgb, bg.rgb) >= 1.4)
  .sort((a, b) => score(b) - score(a));
// a vivid color seen in only SOME references when others exist is content, not brand — demoted
// unless nothing recurring is vivid (that's the `warnings` case below)
if (imgs.length > 1 && vivid.some((c) => c.images === imgs.length)) {
  const dropped = vivid.filter((c) => c.images < imgs.length);
  if (dropped.length) warnings.push(`ignored one-off vivid colors (in fewer than all references): ${dropped.slice(0, 3).map((c) => (c.peak || c).hex).join(', ')}.`);
}
const vividAll = imgs.length > 1 && vivid.some((c) => c.images === imgs.length) ? vivid.filter((c) => c.images === imgs.length) : vivid;
const asPeak = (c) => (c && c.peak && c.peak.chroma > c.chroma * 1.15 ? { ...c, hex: c.peak.hex, rgb: c.peak.rgb, lab: c.peak.lab, chroma: c.peak.chroma, meanHex: c.hex } : c);
let accent = asPeak(vividAll[0]);
if (!accent) {
  const fallback = clusters.filter((c) => !near(c, bg, 0.1) && !near(c, text, 0.1)).sort((a, b) => b.chroma - a.chroma)[0];
  accent = fallback || text;
  warnings.push('no vivid color found — accent is the most colorful cluster available; the brand may genuinely be monochrome (set accent by hand).');
}
const accent2 = asPeak(vividAll.find((c) => (c.peak ? c.peak.hex : c.hex) !== accent.hex && hueDiff(c.hue, accent.hue) > 35)) || null;
if (accent2 && accent2.weight >= 0.008 && accent.weight >= 0.008) {
  warnings.push(`accent ${accent.hex} and accent2 ${accent2.hex} both cover real area — check the reference for a gradient/duo-tone (brand.gradient).`);
}

// ---- muted: low-chroma mid-contrast cluster; else derived mix ----
let muted = clusters.find((c) => c.weight >= 0.004 && c.chroma < 0.08 && !near(c, bg, 0.12) && !near(c, surface, 0.06)
  && !near(c, text, 0.12) && contrast(c.rgb, bg.rgb) >= 2.2 && contrast(c.rgb, bg.rgb) <= 7);
if (!muted) {
  const rgb = mix(text.rgb, bg.rgb, 0.45).map(Math.round);
  muted = { hex: hex(...rgb), rgb, lab: oklab(...rgb), weight: 0, derivedFrom: 'text↔bg 45%' };
  derived.push('muted');
}

const ratio = (a, b) => +contrast(a.rgb, b.rgb).toFixed(2);
const roles = { bg: bg.hex, surface: surface.hex, text: text.hex, muted: muted.hex, accent: accent.hex, ...(accent2 ? { accent2: accent2.hex } : {}) };
// how much of the image each role actually covers (0 = derived) — compare.mjs uses it to ignore
// a role that is basically absent from a reference (a 0.05% red pixel blob is not "the accent")
const roleShare = Object.fromEntries([['bg', bg], ['surface', surface], ['text', text], ['muted', muted], ['accent', accent], ...(accent2 ? [['accent2', accent2]] : [])]
  .map(([k, c]) => [k, +((c.weight || 0) * 100).toFixed(3)]));
const checks = {
  textOnBg: ratio(text, bg), mutedOnBg: ratio(muted, bg), accentOnBg: ratio(accent, bg),
  ...(accent2 ? { accent2OnBg: ratio(accent2, bg) } : {}),
};
if (checks.accentOnBg < 3) warnings.push(`accent ${accent.hex} has ${checks.accentOnBg}:1 on bg — fine for fills, weak for accent TEXT (kicker/CTA). Consider a lighter/darker variant for text use.`);
if (clusters.length && clusters[0].weight < 0.25 && imgs.length === 1) warnings.push('no dominant flat area in the single reference — likely a photo; add a screenshot of the site/logo lockup for a reliable palette.');

const result = {
  images: imgs.map((i) => ({ file: i.file, size: `${i.W}x${i.H}` })),
  roles,
  roleShare,
  derived,
  contrast: checks,
  warnings,
  clusters: clusters.slice(0, 16).map((c) => ({ hex: c.hex, ...(c.peak && c.peak.hex !== c.hex ? { peak: c.peak.hex } : {}), sharePct: +(c.weight * 100).toFixed(2), images: c.images, L: +c.L.toFixed(3), chroma: +c.chroma.toFixed(3), hue: Math.round(c.hue) })),
  brandJsonPalette: roles,
};

if (opts.sheet) {
  const thumbs = await Promise.all(imgs.map((i) => toDataUri(i.im, 420)));
  const sw = (label, hx, meta = '') => `<div class="sw"><div class="c" style="background:${hx}"></div><div class="t"><div class="role">${label}</div><div>${hx}</div><div class="m">${meta}</div></div></div>`;
  const html = `<!doctype html><meta charset="utf-8"><style>${SHEET_CSS}</style><div id="sheet">
    <h2>references</h2><div class="row">${thumbs.map((t, i) => `<div><img class="thumb" src="${t}"><div class="m" style="margin-top:4px">${path.basename(imgs[i].file)} · ${imgs[i].W}×${imgs[i].H}</div></div>`).join('')}</div>
    <h2>roles</h2><div class="row">${Object.entries(roles).map(([k, v]) => sw(k + (derived.includes(k) ? ' (derived)' : ''), v, k === 'text' ? `${checks.textOnBg}:1 on bg` : k === 'accent' ? `${checks.accentOnBg}:1 on bg` : k === 'muted' ? `${checks.mutedOnBg}:1 on bg` : '')).join('')}</div>
    <h2>clusters (share · in N images)</h2><div class="row">${result.clusters.map((c) => sw('', c.hex, `${c.sharePct}% · ${c.images}/${imgs.length} img · C ${c.chroma}`)).join('')}</div>
    ${warnings.length ? `<h2>warnings</h2>${warnings.map((w) => `<div class="warn">⚠ ${w}</div>`).join('')}` : ''}
  </div>`;
  result.sheet = await shotHtml(html, opts.sheet, { width: 1400, height: 900 });
}
if (opts.json) fs.writeFileSync(opts.json, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
