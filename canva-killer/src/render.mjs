#!/usr/bin/env node
// canva-killer — render core.
// Preenche um template (HTML/CSS/SVG) com os tokens de uma marca + o conteúdo do post,
// e exporta um PNG via Chromium headless. A função `render()` é pura o suficiente pra ser
// chamada tanto pela CLI quanto pelo wrapper MCP (mesma lógica, zero duplicação).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
// Overlay de usuário: dados privados/gerados (marcas reais, assets autorados, templates extras,
// PNGs exportados) vivem fora do framework, em <repo>/user/canva-killer/ (gitignored). Toda
// resolução de brand/template/ícone custom procura ali primeiro e cai pro framework por baixo —
// assim o repo público carrega só o `_TEMPLATE`/marca de exemplo, nunca dado real do usuário.
export const USER_ROOT = path.resolve(ROOT, '..', 'user', 'canva-killer');

const BRANDS_DIR = path.join(ROOT, 'brands');
export const USER_BRANDS_DIR = path.join(USER_ROOT, 'brands');
export const TEMPLATES_DIR = path.join(ROOT, 'templates');
export const USER_TEMPLATES_DIR = path.join(USER_ROOT, 'templates');
const ICONS_DIR = path.join(ROOT, 'node_modules', 'lucide-static', 'icons'); // ~1500 ícones Lucide
const CUSTOM_ICONS_DIR = path.join(ROOT, 'assets', 'custom'); // SVGs de exemplo do framework
export const USER_CUSTOM_ICONS_DIR = path.join(USER_ROOT, 'assets', 'custom'); // SVGs gerados pela skill svg-builder (dado de usuário)
const BASE_CSS = path.join(ROOT, 'partials', 'base.css'); // reset + camadas de fundo + padrões, injetado via {{baseStyles}}
const DEFAULT_OUT_DIR = path.join(USER_ROOT, 'out'); // PNGs exportados — dado de usuário

function isDir(d) {
  try { return fs.statSync(d).isDirectory(); } catch { return false; }
}

// Lista nomes (sem extensão) de um par overlay (user + framework), user vence em conflito de nome.
function listOverlay(userDir, frameworkDir, ext) {
  const names = new Map();
  for (const dir of [frameworkDir, userDir]) {
    if (!isDir(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith(ext) && !f.startsWith('_')) names.set(f.slice(0, -ext.length), path.join(dir, f));
    }
  }
  return names;
}

// Resolve um arquivo por nome no overlay: user primeiro, framework por baixo.
function resolveOverlay(userDir, frameworkDir, filename) {
  const userPath = path.join(userDir, filename);
  return fs.existsSync(userPath) ? userPath : path.join(frameworkDir, filename);
}

// Ruído procedural (pat-noise) como data URI — gerado com encodeURIComponent pra não quebrar.
// fractalNoise dessaturado (feColorMatrix saturate 0) => textura cinza sutil.
const NOISE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`;
const NOISE_URI = `data:image/svg+xml,${encodeURIComponent(NOISE_SVG)}`;

// Chrome do sistema — evita baixar os binários do Playwright. Sobrescreva com CHROME_PATH.
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';

// Arquivos começando com "_" são skeletons de template (ex.: _TEMPLATE.json) — não são marcas
// nem layouts reais, então ficam fora da listagem.
export function listBrands() {
  return [...listOverlay(USER_BRANDS_DIR, BRANDS_DIR, '.json').keys()];
}
export function listTemplates() {
  return [...listOverlay(USER_TEMPLATES_DIR, TEMPLATES_DIR, '.html').keys()];
}
export function resolveTemplatePath(templateId) {
  return resolveOverlay(USER_TEMPLATES_DIR, TEMPLATES_DIR, `${templateId}.html`);
}
export function getBrand(brandId) {
  return JSON.parse(fs.readFileSync(resolveOverlay(USER_BRANDS_DIR, BRANDS_DIR, `${brandId}.json`), 'utf8'));
}

// base.css preenchido com os tokens de uma marca — usado pelo studio pra o canvas do editor
// ficar WYSIWYG (mesmos padrões/camadas do render final).
export function baseStylesFor(brandId) {
  return fillTemplate('{{baseStyles}}', getBrand(brandId), {});
}

// Lista de ícones Lucide (nomes), com filtro opcional — usada pelo navegador de ícones do studio.
export function listIcons(q = '', limit = 400) {
  const all = fs.readdirSync(ICONS_DIR).filter((f) => f.endsWith('.svg')).map((f) => f.replace(/\.svg$/, ''));
  const filtered = q ? all.filter((n) => n.includes(q.toLowerCase())) : all;
  return { total: filtered.length, names: filtered.slice(0, limit) };
}

// Resolve o slot de imagem de fundo: `data.bgimage` pode ser uma URL http(s) ou um caminho
// local (absoluto ou relativo ao cwd). Vira o CSS que preenche `.bg-photo` no template.
// Vazio quando não há imagem — aí o template mostra só o fundo sólido + grid.
//
// Imagem local é embutida como data URI (base64): a página vem de setContent (origem
// about:blank), então o Chromium bloquearia um file:// externo por segurança. URL http(s)
// é usada direto (exige que o Chromium tenha rede no ambiente).
export function resolveBgStyle(bgimage) {
  if (!bgimage) return '';
  let url;
  if (/^https?:\/\//i.test(bgimage)) {
    url = bgimage;
  } else {
    const abs = path.resolve(bgimage);
    const ext = path.extname(abs).slice(1).toLowerCase();
    const mime = ext === 'jpg' ? 'jpeg' : (ext || 'png');
    url = `data:image/${mime};base64,${fs.readFileSync(abs).toString('base64')}`;
  }
  // aspas SIMPLES: o template usa style="{{bgstyle}}" (aspas duplas); usar " aqui fecharia o atributo.
  return `background-image:url('${url}');background-size:cover;background-position:center;`;
}

// Resolve {{icon:nome}} -> SVG inline. "custom/xxx" busca em assets/custom/ (SVGs gerados pela
// skill svg-builder); os demais vêm da biblioteca Lucide. Os width/height fixos são removidos
// pra o container (CSS) controlar o tamanho; stroke="currentColor" faz herdar a cor do CSS.
export function resolveIcon(name) {
  const file = name.startsWith('custom/')
    ? resolveOverlay(USER_CUSTOM_ICONS_DIR, CUSTOM_ICONS_DIR, name.slice(7) + '.svg')
    : path.join(ICONS_DIR, `${name}.svg`);
  if (!fs.existsSync(file)) {
    process.stderr.write(`[canva-killer] ícone não encontrado: "${name}"\n`);
    return '';
  }
  return fs.readFileSync(file, 'utf8').replace(/\s(?:width|height)="[^"]*"/g, '');
}

// Preenche {{token}} no HTML a partir de: paleta + fontes + metadados da marca + o `data` do post.
// `data` vence a marca (permite override por post). Campos de conteúdo aceitam HTML inline
// (ex.: <span class="hl">palavra</span>) — o autor do template controla a superfície.
export function fillTemplate(html, brand, data = {}) {
  const tokens = {
    ...brand.palette,
    display: brand.fonts.display,
    mono: brand.fonts.mono,
    googleFonts: brand.fonts.googleFonts,
    logoText: brand.logoText,
    handle: brand.handle,
    name: brand.name,
    pixel: brand.fonts.pixel || brand.fonts.display, // fonte pixel/retrô opcional
    logoSvg: brand.logo ? resolveIcon(brand.logo) : '', // wordmark inline (recolorível via currentColor)
    kicker: '', titulo: '', cta: '', topright: '',
    ...data,
    bgstyle: resolveBgStyle(data.bgimage), // vence o `data` acima; nunca deixa o template com bgstyle cru
    // classe do padrão de fundo: data.pattern > brand.pattern > 'grid'
    patternClass: `pat-${data.pattern || brand.pattern || 'grid'}`,
    noiseUri: NOISE_URI,
  };
  const fillTokens = (s) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => (tokens[k] != null ? String(tokens[k]) : ''));
  // base.css preenchido com os tokens (sem ícones) -> vira o valor de {{baseStyles}}
  tokens.baseStyles = fillTokens(fs.readFileSync(BASE_CSS, 'utf8'));
  // 1) ícones: {{icon:shield}} (Lucide) ou {{icon:custom/pirata}} (assets/custom) -> SVG inline
  html = html.replace(/\{\{icon:([\w/-]+)\}\}/g, (_, name) => resolveIcon(name));
  // 2) tokens simples (inclui {{baseStyles}})
  return fillTokens(html);
}

function launchBrowser() {
  return chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
}

// Renderiza UM quadro numa página de um browser já aberto. Reutilizado por render() (abre/fecha
// o browser) e renderCarousel() (abre uma vez pra N slides).
async function renderInPage(browser, { brandId, templateId = 'post-square', data = {}, out }) {
  const brand = getBrand(brandId);
  const templateHtml = fs.readFileSync(resolveTemplatePath(templateId), 'utf8');
  const html = fillTemplate(templateHtml, brand, data);
  const outPath = out || path.join(DEFAULT_OUT_DIR, `${brandId}-${templateId}.png`);

  // deviceScaleFactor 2 => PNG @2x (nítido; as redes reamostram). O screenshot do elemento
  // #canvas captura o box inteiro mesmo maior que o viewport, então um viewport fixo serve.
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 2 });
  try {
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready); // espera as fontes carregarem
    const el = await page.$('#canvas');
    if (!el) throw new Error(`template "${templateId}" não tem um elemento #canvas`);
    // Captura por clip com o viewport ajustado ao #canvas — evita o "wait for stable" do
    // elementHandle.screenshot (que trava com certos conteúdos, ex. SVG inline) e o stitch de scroll.
    const box = await el.boundingBox();
    await page.setViewportSize({ width: Math.ceil(box.x + box.width), height: Math.ceil(box.y + box.height) });
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    await page.screenshot({ path: outPath, clip: box });
    return outPath;
  } finally {
    await page.close();
  }
}

// Renderiza um quadro. Abre e fecha o browser.
export async function render(opts) {
  const browser = await launchBrowser();
  try {
    return await renderInPage(browser, opts);
  } finally {
    await browser.close();
  }
}

// Renderiza um carrossel inteiro numa ÚNICA abertura de browser. `slides` é um array de objetos
// `data` (um por slide). Numera {{slide}}/{{slidetotal}} automaticamente quando o slide não os
// traz. Retorna os caminhos dos PNGs na ordem (out/<prefix>-01.png, -02.png, ...).
export async function renderCarousel({ brandId, templateId = 'carrossel-slide', slides, outDir, prefix }) {
  if (!Array.isArray(slides) || slides.length === 0) {
    throw new Error('renderCarousel: `slides` deve ser um array não-vazio');
  }
  const dir = outDir || DEFAULT_OUT_DIR;
  const pre = prefix || `${brandId}-carrossel`;
  const total = String(slides.length).padStart(2, '0');

  const browser = await launchBrowser();
  try {
    const paths = [];
    for (let i = 0; i < slides.length; i++) {
      const n = String(i + 1).padStart(2, '0');
      // numeração automática primeiro; o que o slide trouxer (inclusive slide/slidetotal) vence.
      const data = { slide: n, slidetotal: total, ...slides[i] };
      paths.push(await renderInPage(browser, { brandId, templateId, data, out: path.join(dir, `${pre}-${n}.png`) }));
    }
    return paths;
  } finally {
    await browser.close();
  }
}

// ---- CLI ----
function arg(name, def) { const i = process.argv.indexOf('--' + name); return i >= 0 ? process.argv[i + 1] : def; }
const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const brandId = arg('brand', '4gentes');
  const templateId = arg('template');
  const dataPath = arg('data');
  const out = arg('out');
  const parsed = dataPath ? JSON.parse(fs.readFileSync(dataPath, 'utf8')) : {};
  // --data com um array (ou { slides: [...] }) => carrossel; senão, um quadro só.
  const slides = Array.isArray(parsed) ? parsed : parsed.slides;
  if (slides) {
    renderCarousel({ brandId, templateId: templateId || 'carrossel-slide', slides, outDir: arg('outdir'), prefix: arg('prefix') })
      .then(ps => console.log(`OK -> ${ps.length} slides:\n` + ps.join('\n')))
      .catch(e => { console.error('ERRO:', e.message); process.exit(1); });
  } else {
    render({ brandId, templateId: templateId || 'post-square', data: parsed, out })
      .then(p => console.log('OK ->', p))
      .catch(e => { console.error('ERRO:', e.message); process.exit(1); });
  }
}
