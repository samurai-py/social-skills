#!/usr/bin/env node
// brand-identity skill helper — deterministic dominant-color extraction from a reference image.
// Histogram-based (quantize to 16 levels/channel, count buckets): cheap, dependency-light
// approximation of k-means clustering. Deterministic, so re-running on the same image always
// gives the same swatches — unlike eyeballing hex codes from a screenshot by inspection alone.
//
// Usage: node extract-palette.mjs <image-path> [topN=12]
// Output: JSON on stdout — { swatches: [...], suggested: { bg, text, surface, muted, accent, accent2 } }
// `suggested` is a heuristic starting point (frequency = area, saturation = likely accent),
// NOT a final answer — the calling skill must sanity-check it against the reference image
// visually (does "accent" actually look like the brand's highlight color?) before writing brand.json.

import { Jimp } from 'jimp';

const [, , imagePath, topNArg] = process.argv;
if (!imagePath) {
  console.error('Usage: node extract-palette.mjs <image-path> [topN=12]');
  process.exit(1);
}
const topN = Number(topNArg) || 12;

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}
// WCAG-ish relative luminance, 0 (black) .. 1 (white) — used to pick bg/text as a contrasting pair.
function luminance(r, g, b) {
  const [R, G, B] = [r, g, b].map((v) => v / 255);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
// HSL saturation, 0 (gray) .. 1 (vivid) — used to tell an "accent" (vivid, used sparingly) apart
// from bg/surface/muted (large flat areas, usually low-saturation neutrals). DEGENERATE NEAR THE
// EXTREMES: a near-white pixel with a tiny 15/255 channel residue (JPEG noise, antialiasing edge)
// can score saturation ~1.0 because the formula's denominator (2-max-min or max+min) shrinks
// right along with the residue — mathematically "saturated" but perceptually colorless. Caught
// this by testing on a real photo: near-white antialiasing pixels outranked the actual orange
// logo. `chroma()` below is the guard — it stays near 0 for those pixels because it's an
// absolute, not relative, measure.
function saturation(r, g, b) {
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255;
  if (max === min) return 0;
  const l = (max + min) / 2;
  const d = max - min;
  return l > 0.5 ? d / (2 - max - min) : d / (max + min);
}
// Absolute chroma (max-min channel, 0..255) — doesn't blow up near white/black like HSL
// saturation does, so it's the gate that actually separates "genuinely colorful" from
// "technically saturated by the formula but visually gray/white/black".
function chroma(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b);
}
// Hue angle 0-360deg — used only to keep accent2 a genuinely different color from accent
// (without this, quantization neighbors of the same color, e.g. #f06010 and #f07010, both rank
// near the top of vividOutliers and accent2 ends up as a clone of accent instead of the
// design's actual secondary highlight).
function hue(r, g, b) {
  const [R, G, B] = [r, g, b].map((v) => v / 255);
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  if (d === 0) return 0;
  let h;
  if (max === R) h = ((G - B) / d) % 6;
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}
function hueOf(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return hue(r, g, b);
}
function hueDiff(h1, h2) {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}

const image = await Jimp.read(imagePath);
image.resize({ w: 120, h: 120 }); // downscale: enough signal for dominant colors, fast to bucket
const { data } = image.bitmap;

const STEP = 16; // quantization step per channel (256/16 = 16 buckets/channel, 4096 total)
const buckets = new Map();
for (let i = 0; i < data.length; i += 4) {
  if (data[i + 3] < 128) continue; // skip transparent pixels
  const r = Math.round(data[i] / STEP) * STEP;
  const g = Math.round(data[i + 1] / STEP) * STEP;
  const b = Math.round(data[i + 2] / STEP) * STEP;
  const key = `${r},${g},${b}`;
  buckets.set(key, (buckets.get(key) || 0) + 1);
}

const total = [...buckets.values()].reduce((a, b) => a + b, 0) || 1;
const all = [...buckets.entries()].map(([key, count]) => {
  const [r, g, b] = key.split(',').map(Number);
  return {
    hex: rgbToHex(r, g, b),
    frequencyPct: +((count / total) * 100).toFixed(2),
    luminance: +luminance(r, g, b).toFixed(3),
    saturation: +saturation(r, g, b).toFixed(3),
    chroma: chroma(r, g, b),
  };
});

// `swatches` = by AREA (frequency) — right signal for bg/surface/muted, which are genuinely
// large flat regions. Sliced to topN.
const swatches = [...all].sort((a, b) => b.frequencyPct - a.frequencyPct).slice(0, topN);

// `vividOutliers` = by SATURATION across the FULL pixel population, not just the top-N by area.
// A brand's real accent (a logo mark, a small badge, a CTA button) is very often a tiny fraction
// of total area and gets discarded by a frequency cutoff before saturation is ever considered —
// that's a real failure mode this script had: a small vivid logo lost to a frequency slice,
// while a duller but larger UI-chrome color won "most saturated of the top N" by default.
// Floor of 0.05% filters single-pixel/antialiasing-count noise; `chroma >= 60` filters the
// near-white/near-black pixels where HSL saturation degenerates (see saturation() above) —
// without it, JPEG noise on a white background outranks a real orange logo. Anything past both
// gates stays in the pool regardless of frequency rank, so a 2%-of-image logo mark still surfaces.
// Ranked by CHROMA first, not HSL saturation: saturation formula hits its 1.0 ceiling whenever
// any channel is exactly 0 regardless of how vivid the color actually is (confirmed on this same
// image — several petrol/navy blues scored a flat saturation=1 and outranked a much more vivid
// orange with saturation=0.88 but nearly 2x the chroma). Chroma has no such ceiling artifact.
const vividOutliers = all
  .filter((s) => s.saturation > 0.5 && s.chroma >= 60 && s.frequencyPct >= 0.05)
  .sort((a, b) => b.chroma - a.chroma || b.frequencyPct - a.frequencyPct)
  .slice(0, 8);

const bg = swatches[0];
// text: the swatch with the widest luminance gap vs bg (max contrast candidate)
const text = [...swatches].sort((a, b) => Math.abs(b.luminance - bg.luminance) - Math.abs(a.luminance - bg.luminance))[0];
// surface: next most frequent neutral close in luminance to bg (a card/panel tone), else 2nd most frequent
const surface = swatches.find((s) => s.hex !== bg.hex && Math.abs(s.luminance - bg.luminance) < 0.25) || swatches[1] || bg;
// muted: mid-saturation swatch, sorted ascending by saturation and taking the middle one
const bySat = [...swatches].sort((a, b) => a.saturation - b.saturation);
const muted = bySat[Math.floor(bySat.length / 2)] || bg;
// accent/accent2: prefer a vivid outlier (small-area brand mark) over the top-N-by-area pool —
// fall back to "most saturated of the top N" only if nothing vivid was found anywhere.
const vividPool = vividOutliers.length
  ? vividOutliers.filter((s) => s.hex !== bg.hex && s.hex !== text.hex)
  : [...swatches].filter((s) => s.hex !== bg.hex && s.hex !== text.hex).sort((a, b) => b.saturation - a.saturation);
const accent = vividPool[0] || swatches[swatches.length - 1] || bg;
// accent2 must differ in HUE (>40deg), not just hex — otherwise a quantization neighbor of the
// same color (e.g. #f06010 vs #f07010) wins by frequency/chroma tiebreak and accent2 ends up a
// near-duplicate of accent instead of the design's actual secondary color.
const accentHue = hueOf(accent.hex);
const accent2 = vividPool.find((s) => s.hex !== accent.hex && hueDiff(hueOf(s.hex), accentHue) > 40)
  || vividPool.find((s) => s.hex !== accent.hex)
  || accent;

console.log(JSON.stringify({
  swatches,
  vividOutliers,
  suggested: { bg: bg.hex, text: text.hex, surface: surface.hex, muted: muted.hex, accent: accent.hex, accent2: accent2.hex },
}, null, 2));
