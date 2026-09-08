#!/usr/bin/env node
// canva-killer studio — minimal local server.
// Serves the studio page and reuses render.mjs:
//   GET  /                      -> index.html
//   GET  /api/brands            -> [{id, ...brand}]
//   GET  /api/templates?brand=X -> [id, ...] (generic layouts + X's own exclusive templates)
//   GET  /api/template?id=X&brand=Y -> raw template HTML (to detect tokens + dims)
//   POST /api/preview           -> filled HTML (fillTemplate) for the iframe preview (fast)
//   POST /api/render            -> PNG @2x (Playwright) for the final export
//   POST /api/save-template     -> writes templates/<brandId>/<name>.html ("Create template" mode)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  listBrands, listTemplates, getBrand, fillTemplate, render, baseStylesFor, listIcons, resolveIcon, fontFacesFor,
  resolveTemplatePath, USER_ROOT, USER_TEMPLATES_DIR, USER_BRANDS_DIR, USER_CUSTOM_ICONS_DIR, USER_FONTS_DIR, TEMPLATES_DIR,
} from '../src/render.mjs';
import { blocksToHtml, htmlToBlocks } from '../src/converter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IDENTITY_DIR = path.join(__dirname, '..', '..', 'identity'); // SocialSkills identity (mascots, mark)
const PORT = Number(process.env.PORT) || 4173;

const send = (res, status, body, type = 'application/json') => {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
};
const json = (res, obj, status = 200) => send(res, status, JSON.stringify(obj), 'application/json');
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}
// Parses a JSON POST body defensively: this is a local, unauthenticated dev server, so the two
// checks below are the only thing standing between "open a malicious page in the same browser"
// and CSRF file read/write. Content-Type must genuinely be application/json (blocks the classic
// text/plain <form> trick that smuggles JSON past a same-origin-policy-exempt request), and any
// present Origin/Referer must point at this same server (blocks plain cross-origin fetch/XHR).
// Strips script execution vectors from a user-uploaded SVG before it's saved: <script>/<foreignObject>
// tags, on*="" event handlers, and javascript:/data:text/html URIs. Not a full sanitizer (no DOM
// parser here), but closes the practical XSS path for an icon/logo that later gets inlined via innerHTML.
function sanitizeSvg(svg) {
  return svg
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/(href|xlink:href)\s*=\s*"(?:\s*javascript:|\s*data:text\/html)[^"]*"/gi, '$1="#"')
    .replace(/(href|xlink:href)\s*=\s*'(?:\s*javascript:|\s*data:text\/html)[^']*'/gi, "$1='#'");
}

function readJsonBody(req) {
  const ct = req.headers['content-type'] || '';
  if (!ct.toLowerCase().startsWith('application/json')) {
    throw Object.assign(new Error('expected content-type: application/json'), { statusCode: 415 });
  }
  const origin = req.headers.origin || req.headers.referer;
  if (origin && new URL(origin).host !== req.headers.host) {
    throw Object.assign(new Error('cross-origin request rejected'), { statusCode: 403 });
  }
  return readBody(req).then((body) => JSON.parse(body));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const p = url.pathname;

    if (p === '/') {
      return send(res, 200, fs.readFileSync(path.join(__dirname, 'index.html')), 'text/html; charset=utf-8');
    }
    if (p.startsWith('/identity/')) {
      const file = path.join(IDENTITY_DIR, path.basename(p));
      if (!fs.existsSync(file)) return send(res, 404, 'not found', 'text/plain');
      return send(res, 200, fs.readFileSync(file), file.endsWith('.svg') ? 'image/svg+xml; charset=utf-8' : 'text/plain; charset=utf-8');
    }
    if (p === '/api/brands') {
      return json(res, listBrands().map((id) => ({ id, ...getBrand(id) })));
    }
    if (p === '/api/templates') {
      return json(res, listTemplates(url.searchParams.get('brand') || ''));
    }
    if (p === '/api/template') {
      const file = resolveTemplatePath(path.basename(url.searchParams.get('id') || ''), url.searchParams.get('brand') || '');
      if (!fs.existsSync(file)) return json(res, { error: 'template not found' }, 404);
      return send(res, 200, fs.readFileSync(file, 'utf8'), 'text/plain; charset=utf-8');
    }
    // the studio imports the converter (effects, bar CSS) so it never carries a copy
    if (p === '/converter.mjs') {
      return send(res, 200, fs.readFileSync(path.join(__dirname, '..', 'src', 'converter.mjs')), 'text/javascript; charset=utf-8');
    }
    if (p === '/inspect.mjs' || p === '/brandfonts.mjs') {
      return send(res, 200, fs.readFileSync(path.join(__dirname, p.slice(1))), 'text/javascript; charset=utf-8');
    }
    // INSPECT & ADJUST: writes the <style data-ck-overrides> block into the brand's template.
    // A framework skeleton is copied into the brand's folder first (the framework files are never
    // edited; the brand gets its own copy under the same id and the skeleton drops out of its list).
    if (p === '/api/save-overrides' && req.method === 'POST') {
      const { brandId, templateId, css } = await readJsonBody(req);
      const safeBrand = String(brandId || '').replace(/[^\w-]/g, '').slice(0, 60);
      const safeTpl = String(templateId || '').replace(/[^\w-]/g, '').slice(0, 60);
      if (!safeBrand || !safeTpl) return json(res, { error: 'invalid brandId/templateId' }, 400);
      // the CSS lands verbatim inside a <style> that the studio later renders same-origin, so it
      // must be CSS only: no markup at all, and only `selector{decl;...}` rules
      const cssText = String(css || '').trim();
      if (/[<>]/.test(cssText) || !/^(\s*[^{}<>]+\{[^{}<>]*\}\s*)*$/.test(cssText)) {
        return json(res, { error: 'overrides must be plain CSS rules (selector{...}), no markup' }, 400);
      }
      const src = resolveTemplatePath(safeTpl, safeBrand);
      if (!fs.existsSync(src)) return json(res, { error: 'template not found' }, 404);
      const dst = path.join(USER_TEMPLATES_DIR, safeBrand, `${safeTpl}.html`);
      let html = fs.readFileSync(src, 'utf8');
      const copied = path.resolve(src).startsWith(path.resolve(TEMPLATES_DIR));
      const block = cssText ? `<style data-ck-overrides>\n${cssText}\n</style>` : '';
      if (/<style data-ck-overrides>[\s\S]*?<\/style>\n?/.test(html)) html = html.replace(/\n?<style data-ck-overrides>[\s\S]*?<\/style>\n?/, block ? `\n${block}\n` : '\n');
      else if (block) html = html.replace(/<\/head>/i, `${block}\n</head>`);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.writeFileSync(dst, html);
      return json(res, { ok: true, file: dst, copiedFromFramework: copied });
    }
    // Brand tab font upload -> user/canva-killer/fonts/<brandId>/<file> (becomes @font-face)
    if (p === '/api/upload-font' && req.method === 'POST') {
      const { brandId, name, data } = await readJsonBody(req);
      const safeBrand = String(brandId || '').replace(/[^\w-]/g, '').slice(0, 60);
      const file = path.basename(String(name || '')).replace(/[^\w. -]/g, '');
      if (!safeBrand || !/\.(woff2?|ttf|otf)$/i.test(file) || !data) return json(res, { error: 'brandId, a .woff2/.woff/.ttf/.otf name and base64 data are required' }, 400);
      const dir = path.join(USER_FONTS_DIR, safeBrand);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, file), Buffer.from(String(data), 'base64'));
      return json(res, { ok: true, file: path.join(dir, file) });
    }
    if (p === '/api/preview' && req.method === 'POST') {
      const { brandId, templateId, data, brand } = await readJsonBody(req);
      const tpl = fs.readFileSync(resolveTemplatePath(path.basename(templateId), brandId), 'utf8');
      // `brand` (optional) = the in-memory brand being edited in the Brand tab, so the preview
      // reflects unsaved palette/font changes; identity fields stay pinned to the saved brand.
      const saved = getBrand(brandId);
      const effective = brand && typeof brand === 'object' ? { ...saved, ...brand, id: saved.id } : saved;
      return send(res, 200, fillTemplate(tpl, effective, data || {}), 'text/html; charset=utf-8');
    }
    if (p === '/api/render' && req.method === 'POST') {
      const { brandId, templateId, data } = await readJsonBody(req);
      const out = path.join(USER_ROOT, 'out', `studio-${path.basename(templateId)}.png`);
      await render({ brandId, templateId, data: data || {}, out });
      return send(res, 200, fs.readFileSync(out), 'image/png');
    }
    if (p === '/api/save-template' && req.method === 'POST') {
      const { name, dims, blocks, meta, brandId } = await readJsonBody(req);
      const safe = String(name || '').replace(/[^\w-]/g, '').slice(0, 60);
      const safeBrand = String(brandId || '').replace(/[^\w-]/g, '').slice(0, 60);
      if (!safe) return json(res, { error: 'invalid name' }, 400);
      if (!safeBrand) return json(res, { error: 'invalid brandId' }, 400);
      // templates authored in the studio are user data, and exclusive to the active brand ->
      // user/canva-killer/templates/<brandId>/ (overlay: layers on top of/adds to the
      // framework's base templates, never writes to them; never shared across brands).
      const brandTemplatesDir = path.join(USER_TEMPLATES_DIR, safeBrand);
      fs.mkdirSync(brandTemplatesDir, { recursive: true });
      // converter IN CODE: block model -> HTML (with the model embedded to reopen/edit)
      fs.writeFileSync(path.join(brandTemplatesDir, `${safe}.html`), blocksToHtml({ dims, blocks, meta }));
      return json(res, { ok: true, id: safe });
    }
    if (p === '/api/blocks') {
      const file = resolveTemplatePath(path.basename(url.searchParams.get('id') || ''), url.searchParams.get('brand') || '');
      if (!fs.existsSync(file)) return json(res, { editable: false });
      const model = htmlToBlocks(fs.readFileSync(file, 'utf8')); // reads the model embedded in the HTML
      if (!model) return json(res, { editable: false }); // code-only template (no model)
      return json(res, { editable: true, ...model });
    }
    if (p === '/api/font-faces') { // the brand's own @font-face rules, for the editor canvas
      return send(res, 200, fontFacesFor(getBrand(url.searchParams.get('brand') || '')), 'text/css; charset=utf-8');
    }
    if (p === '/api/base-css') {
      return send(res, 200, baseStylesFor(url.searchParams.get('brand') || listBrands()[0]), 'text/css; charset=utf-8');
    }
    if (p === '/api/icons') {
      return json(res, listIcons(url.searchParams.get('q') || '', Number(url.searchParams.get('limit')) || 400));
    }
    if (p === '/api/icon-svg') {
      const svg = resolveIcon(url.searchParams.get('name') || '', url.searchParams.get('brand') || '');
      return send(res, 200, svg || '<svg/>', 'image/svg+xml; charset=utf-8');
    }
    if (p === '/api/save-brand' && req.method === 'POST') {
      const { brand } = await readJsonBody(req);
      const id = String(brand?.id || '').replace(/[^\w-]/g, '').slice(0, 60);
      if (!id) return json(res, { error: 'invalid brand.id' }, 400);
      // real brands are user data -> user/canva-killer/brands/
      fs.mkdirSync(USER_BRANDS_DIR, { recursive: true });
      fs.writeFileSync(path.join(USER_BRANDS_DIR, `${id}.json`), JSON.stringify(brand, null, 2));
      return json(res, { ok: true, id });
    }
    if (p === '/api/upload-logo' && req.method === 'POST') {
      const { name, svg, brandId } = await readJsonBody(req);
      const safe = String(name || '').replace(/[^\w-]/g, '').slice(0, 60);
      const safeBrand = String(brandId || '').replace(/[^\w-]/g, '').slice(0, 60);
      if (!safe || !svg) return json(res, { error: 'name/svg required' }, 400);
      if (!safeBrand) return json(res, { error: 'invalid brandId' }, 400);
      // authored SVGs (logo, custom icons) are user data, and exclusive to the active brand ->
      // user/canva-killer/assets/custom/<brandId>/ (never shared across brands).
      const brandIconsDir = path.join(USER_CUSTOM_ICONS_DIR, safeBrand);
      fs.mkdirSync(brandIconsDir, { recursive: true });
      // recolor to currentColor: swaps fixed fills for currentColor (inherit the container's color)
      const recolored = svg.replace(/fill\s*:\s*#[0-9a-fA-F]{3,6}/g, 'fill: currentColor').replace(/fill="#[0-9a-fA-F]{3,6}"/g, 'fill="currentColor"');
      // uploaded SVGs get inlined via innerHTML in the studio's own page (not sandboxed) — strip
      // anything that could execute script (the icon/logo rendering only needs markup+CSS).
      const sanitized = sanitizeSvg(recolored);
      fs.writeFileSync(path.join(brandIconsDir, `${safe}.svg`), sanitized);
      return json(res, { ok: true, ref: `custom/${safe}` });
    }
    send(res, 404, 'not found', 'text/plain');
  } catch (err) {
    json(res, { error: err.message }, err.statusCode || 500);
  }
});

// 127.0.0.1 only: this server has no auth and writes to disk on request — binding to all
// interfaces would expose file read/write to anyone else on the same network.
server.listen(PORT, '127.0.0.1', () => process.stderr.write(`canva-killer studio: http://localhost:${PORT}\n`));
