#!/usr/bin/env node
// brand-identity skill helper — FALLBACK when the user has no logo file: cut the logo out of a
// reference image and turn it into a recolorable, transparent asset.
//
//   node cut-logo.mjs <image> --box x,y,w,h --out user/canva-killer/assets/custom/<brandId>/logo.svg
//                     [--mode light|dark] [--threshold 110] [--preview out.png]
//
// The box is in the reference's own pixels — read it off `measure-layout.mjs --overlay` (block
// bbox) or estimate from the gridded overlay. The crop is converted to a single-color alpha mask:
//   light  (default) — light pixels become the logo, dark ones transparent (white logo on dark art)
//   dark             — the opposite (dark logo on a light surface)
// and wrapped in an SVG <image>, so `{{logoSvg}}` / `{{icon:custom/logo}}` work exactly as with a
// vector logo. It is still a raster inside: crisp at the reference's size, soft when scaled up a
// lot — ask the user for the real file whenever possible and treat this as a stopgap.

import fs from 'node:fs';
import path from 'node:path';
import { Jimp } from 'jimp';
import { parseArgs } from './_lib.mjs';

const { pos: [file], opts } = parseArgs(process.argv.slice(2));
if (!file || !fs.existsSync(file) || !opts.box || !opts.out) {
  console.error('Usage: node cut-logo.mjs <image> --box x,y,w,h --out <brand>/logo.svg [--mode light|dark] [--threshold 110] [--preview out.png]');
  process.exit(1);
}
const [x, y, w, h] = String(opts.box).split(',').map(Number);
const mode = opts.mode === 'dark' ? 'dark' : 'light';
const th = Number(opts.threshold) || 110;

const im = await Jimp.read(file);
const c = im.clone().crop({ x, y, w, h });
const { data } = c.bitmap;
let opaque = 0;
for (let i = 0; i < data.length; i += 4) {
  const l = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
  const a = Math.max(0, Math.min(255, Math.round(mode === 'light' ? (l - th) * 2.4 : (th + 60 - l) * 2.4)));
  data[i] = data[i + 1] = data[i + 2] = 255; // color comes from CSS (currentColor via the wrapper's color) — see below
  data[i + 3] = a;
  if (a > 128) opaque++;
}
const png = await c.getBuffer('image/png');
// `mask` + currentColor: the PNG is the alpha shape, the rect supplies the color -> recolorable like a real SVG logo.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><defs><mask id="m"><image width="${w}" height="${h}" href="data:image/png;base64,${png.toString('base64')}"/></mask></defs><rect width="${w}" height="${h}" fill="currentColor" mask="url(#m)"/></svg>`;
fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });
fs.writeFileSync(opts.out, svg);
if (opts.preview) await c.write(opts.preview);
console.log(JSON.stringify({
  out: path.resolve(opts.out), size: `${w}x${h}`, mode, threshold: th,
  coveragePct: +((opaque / (w * h)) * 100).toFixed(1),
  hint: opaque / (w * h) < 0.03 ? 'almost nothing survived the threshold — lower --threshold or check --mode' : opaque / (w * h) > 0.6 ? 'most of the box is opaque — box too tight or wrong --mode' : 'ok — render a test card and look at it',
}, null, 2));
