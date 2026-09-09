#!/usr/bin/env node
// Closed-loop QA helper — puts a REFERENCE next to a RENDER and scores how close they are.
//
//   node compare.mjs <reference.png> <render.png> [--out side-by-side.png]
//
// Numbers, not vibes: palette distance per role (OKLab ΔE), aspect ratio match, content bbox /
// margin drift. The --out PNG shows both images at the same height with the role swatches of each
// underneath — look at it after every render iteration and stop when the score stops improving.
// Score: 100 = identical palette + geometry; > 80 usually reads as "same brand" at a glance.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadImage, toDataUri, oklab, deltaE, parseHex, shotHtml, SHEET_CSS, parseArgs } from './_lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { pos: [ref, ren], opts } = parseArgs(process.argv.slice(2));
if (!ref || !ren || !fs.existsSync(ref) || !fs.existsSync(ren)) { console.error('Usage: node compare.mjs <reference> <render> [--out out.png]'); process.exit(1); }

const run = (script, args) => JSON.parse(execFileSync(process.execPath, [script, ...args], { encoding: 'utf8', maxBuffer: 1 << 26 }));
const pal = (f) => run(path.join(HERE, 'extract-palette.mjs'), [f]);
const lay = (f) => run(path.join(HERE, '..', '..', 'layout-recovery', 'scripts', 'measure-layout.mjs'), [f]);
const [pa, pb, la, lb] = [pal(ref), pal(ren), lay(ref), lay(ren)];

// palette: per-role ΔE (roles present in both)
const roleDelta = {}, ignored = [];
for (const k of Object.keys(pa.roles)) {
  if (!pb.roles[k]) continue;
  // a role that covers < 0.1% of the REFERENCE is noise (a stray red pixel blob in a photo), not
  // a brand color to match — report it, don't score it
  if ((pa.roleShare?.[k] ?? 1) < 0.1 && k !== 'bg' && k !== 'text') { ignored.push(`${k} (${pa.roleShare[k]}% of reference)`); continue; }
  roleDelta[k] = +deltaE(oklab(...parseHex(pa.roles[k])), oklab(...parseHex(pb.roles[k]))).toFixed(3);
}
const deltas = Object.values(roleDelta);
const meanDelta = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 1;
// geometry
const aspectDiff = Math.abs(la.aspect - lb.aspect);
const mA = la.marginsPct || {}, mB = lb.marginsPct || {};
const marginDrift = ['left', 'top', 'right', 'bottom'].map((s) => Math.abs((mA[s] ?? 0) - (mB[s] ?? 0)));
const meanMargin = marginDrift.reduce((a, b) => a + b, 0) / 4;
const bandDiff = Math.abs(la.blocks.length - lb.blocks.length);

const paletteScore = Math.max(0, 100 - meanDelta * 400);          // ΔE 0.25 -> 0
const geometryScore = Math.max(0, 100 - aspectDiff * 300 - meanMargin * 3 - bandDiff * 6);
const score = Math.round(paletteScore * 0.6 + geometryScore * 0.4);

const verdict = [];
for (const [k, d] of Object.entries(roleDelta)) if (d > 0.08) verdict.push(`${k}: reference ${pa.roles[k]} vs render ${pb.roles[k]} (ΔE ${d}) — off.`);
if (aspectDiff > 0.02) verdict.push(`aspect ratio differs (${la.aspect} vs ${lb.aspect}) — wrong #canvas size.`);
if (meanMargin > 3) verdict.push(`margins drift ~${meanMargin.toFixed(1)}% (ref L${mA.left} T${mA.top} R${mA.right} B${mA.bottom} vs render L${mB.left} T${mB.top} R${mB.right} B${mB.bottom}).`);
if (bandDiff >= 2) verdict.push(`content blocks: ${la.blocks.length} in reference vs ${lb.blocks.length} in render — structure differs.`);

const result = {
  reference: ref, render: ren, score, paletteScore: Math.round(paletteScore), geometryScore: Math.round(geometryScore),
  roleDelta, ignoredRoles: ignored, rolesReference: pa.roles, rolesRender: pb.roles,
  aspect: { reference: la.aspect, render: lb.aspect },
  marginsPct: { reference: mA, render: mB }, blocks: { reference: la.blocks.length, render: lb.blocks.length },
  verdict: [...(verdict.length ? verdict : ['no material differences detected by the metrics — do a final visual check.']),
    ...(ignored.length ? [`not scored (negligible in the reference): ${ignored.join(', ')}.`] : [])],
};

if (opts.out) {
  const [ia, ib] = await Promise.all([loadImage(ref, 10), loadImage(ren, 10)]);
  const [ua, ub] = await Promise.all([toDataUri(ia.im, 700), toDataUri(ib.im, 700)]);
  const sw = (roles) => `<div class="row">${Object.entries(roles).map(([k, v]) => `<div class="sw" style="width:84px"><div class="c" style="background:${v};height:34px"></div><div class="t"><span class="role">${k}</span><div>${v}</div></div></div>`).join('')}</div>`;
  const html = `<!doctype html><meta charset="utf-8"><style>${SHEET_CSS} .col{display:flex;flex-direction:column;gap:8px} .col img{height:560px;width:auto;border:1px solid #262624;border-radius:6px}</style>
  <div id="sheet"><div class="pair">
    <div class="col"><h2 style="margin-top:0">reference</h2><img src="${ua}">${sw(pa.roles)}</div>
    <div class="col"><h2 style="margin-top:0">render</h2><img src="${ub}">${sw(pb.roles)}</div>
  </div><h2>score ${score} (palette ${Math.round(paletteScore)} · geometry ${Math.round(geometryScore)})</h2>${result.verdict.map((v) => `<div class="warn">${v}</div>`).join('')}</div>`;
  result.sheet = await shotHtml(html, opts.out, { width: 1500, height: 900 });
}
console.log(JSON.stringify(result, null, 2));
