#!/usr/bin/env node
// canva-killer studio — servidor local mínimo.
// Serve a página do studio e reusa o render.mjs:
//   GET  /                      -> index.html
//   GET  /api/brands            -> [{id, ...brand}]
//   GET  /api/templates         -> [id, ...]
//   GET  /api/template?id=X     -> HTML cru do template (pra detectar tokens + dims)
//   POST /api/preview           -> HTML preenchido (fillTemplate) pro preview no iframe (rápido)
//   POST /api/render            -> PNG @2x (Playwright) pro export final
//   POST /api/save-template     -> grava templates/<name>.html (modo "Criar template")

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  listBrands, listTemplates, getBrand, fillTemplate, render, baseStylesFor, listIcons, resolveIcon,
  resolveTemplatePath, USER_ROOT, USER_TEMPLATES_DIR, USER_BRANDS_DIR, USER_CUSTOM_ICONS_DIR,
} from '../src/render.mjs';
import { blocksToHtml, htmlToBlocks } from '../src/converter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IDENTITY_DIR = path.join(__dirname, '..', '..', 'identity'); // identidade do SocialSkills (mascotes, mark)
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

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const p = url.pathname;

    if (p === '/') {
      return send(res, 200, fs.readFileSync(path.join(__dirname, 'index.html')), 'text/html; charset=utf-8');
    }
    if (p.startsWith('/identity/')) {
      const file = path.join(IDENTITY_DIR, path.basename(p));
      if (!fs.existsSync(file)) return send(res, 404, 'não encontrado', 'text/plain');
      return send(res, 200, fs.readFileSync(file), file.endsWith('.svg') ? 'image/svg+xml; charset=utf-8' : 'text/plain; charset=utf-8');
    }
    if (p === '/api/brands') {
      return json(res, listBrands().map((id) => ({ id, ...getBrand(id) })));
    }
    if (p === '/api/templates') {
      return json(res, listTemplates());
    }
    if (p === '/api/template') {
      const file = resolveTemplatePath(path.basename(url.searchParams.get('id') || ''));
      if (!fs.existsSync(file)) return json(res, { error: 'template não encontrado' }, 404);
      return send(res, 200, fs.readFileSync(file, 'utf8'), 'text/plain; charset=utf-8');
    }
    if (p === '/api/preview' && req.method === 'POST') {
      const { brandId, templateId, data } = JSON.parse(await readBody(req));
      const tpl = fs.readFileSync(resolveTemplatePath(path.basename(templateId)), 'utf8');
      return send(res, 200, fillTemplate(tpl, getBrand(brandId), data || {}), 'text/html; charset=utf-8');
    }
    if (p === '/api/render' && req.method === 'POST') {
      const { brandId, templateId, data } = JSON.parse(await readBody(req));
      const out = path.join(USER_ROOT, 'out', `studio-${path.basename(templateId)}.png`);
      await render({ brandId, templateId, data: data || {}, out });
      return send(res, 200, fs.readFileSync(out), 'image/png');
    }
    if (p === '/api/save-template' && req.method === 'POST') {
      const { name, dims, blocks, meta } = JSON.parse(await readBody(req));
      const safe = String(name || '').replace(/[^\w-]/g, '').slice(0, 60);
      if (!safe) return json(res, { error: 'nome inválido' }, 400);
      // templates autorados no studio são dado de usuário -> user/canva-killer/templates/
      // (overlay: sobrepõe/soma aos templates base do framework, nunca escreve neles)
      fs.mkdirSync(USER_TEMPLATES_DIR, { recursive: true });
      // conversor EM CÓDIGO: modelo de blocos -> HTML (com o modelo embutido pra reabrir/editar)
      fs.writeFileSync(path.join(USER_TEMPLATES_DIR, `${safe}.html`), blocksToHtml({ dims, blocks, meta }));
      return json(res, { ok: true, id: safe });
    }
    if (p === '/api/blocks') {
      const file = resolveTemplatePath(path.basename(url.searchParams.get('id') || ''));
      if (!fs.existsSync(file)) return json(res, { editable: false });
      const model = htmlToBlocks(fs.readFileSync(file, 'utf8')); // lê o modelo embutido no HTML
      if (!model) return json(res, { editable: false }); // template só-código (sem modelo)
      return json(res, { editable: true, ...model });
    }
    if (p === '/api/base-css') {
      return send(res, 200, baseStylesFor(url.searchParams.get('brand') || listBrands()[0]), 'text/css; charset=utf-8');
    }
    if (p === '/api/icons') {
      return json(res, listIcons(url.searchParams.get('q') || '', Number(url.searchParams.get('limit')) || 400));
    }
    if (p === '/api/icon-svg') {
      return send(res, 200, resolveIcon(url.searchParams.get('name') || '') || '<svg/>', 'image/svg+xml; charset=utf-8');
    }
    if (p === '/api/save-brand' && req.method === 'POST') {
      const { brand } = JSON.parse(await readBody(req));
      const id = String(brand?.id || '').replace(/[^\w-]/g, '').slice(0, 60);
      if (!id) return json(res, { error: 'brand.id inválido' }, 400);
      // marcas reais são dado de usuário -> user/canva-killer/brands/
      fs.mkdirSync(USER_BRANDS_DIR, { recursive: true });
      fs.writeFileSync(path.join(USER_BRANDS_DIR, `${id}.json`), JSON.stringify(brand, null, 2));
      return json(res, { ok: true, id });
    }
    if (p === '/api/upload-logo' && req.method === 'POST') {
      const { name, svg } = JSON.parse(await readBody(req));
      const safe = String(name || '').replace(/[^\w-]/g, '').slice(0, 60);
      if (!safe || !svg) return json(res, { error: 'name/svg obrigatórios' }, 400);
      // SVGs autorados (logo, ícones custom) são dado de usuário -> user/canva-killer/assets/custom/
      fs.mkdirSync(USER_CUSTOM_ICONS_DIR, { recursive: true });
      // recolorir p/ currentColor: troca fills fixos por currentColor (herdam a cor do container)
      const recolored = svg.replace(/fill\s*:\s*#[0-9a-fA-F]{3,6}/g, 'fill: currentColor').replace(/fill="#[0-9a-fA-F]{3,6}"/g, 'fill="currentColor"');
      fs.writeFileSync(path.join(USER_CUSTOM_ICONS_DIR, `${safe}.svg`), recolored);
      return json(res, { ok: true, ref: `custom/${safe}` });
    }
    send(res, 404, 'não encontrado', 'text/plain');
  } catch (err) {
    json(res, { error: err.message }, 500);
  }
});

server.listen(PORT, () => process.stderr.write(`canva-killer studio: http://localhost:${PORT}\n`));
