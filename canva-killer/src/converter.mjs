// canva-killer — bidirectional converter (in code) between the BLOCK MODEL and the template's HTML.
// Reused by the AI agent and by the studio. Robust strategy: the generated HTML EMBEDS the block
// model itself in a <script type="application/json" data-ck-model>. That way htmlToBlocks reads
// the model directly (no reverse-parsing CSS) and the round-trip is faithful. The <script> doesn't
// render and lives in the <head>, so it doesn't affect the #canvas screenshot.

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// ---- fonts (pure; used by render.mjs and the studio) ----
const SYSTEM_FONTS = new Set(['system-ui', 'sans-serif', 'serif', 'monospace', 'ui-monospace', 'cursive', 'fantasy', 'inherit', 'initial', 'unset']);
// "'Space Grotesk', system-ui, sans-serif" -> "Space Grotesk"; a stack that starts with a generic family -> '' (nothing to load)
export function cleanFontName(fontFamily) {
  if (!fontFamily) return '';
  const m = String(fontFamily).match(/['"]([^'"]+)['"]/);
  const name = m ? m[1] : String(fontFamily).split(',')[0].trim();
  return SYSTEM_FONTS.has(name.toLowerCase()) ? '' : name;
}
// Stylesheet URL covering EVERY named family in brand.fonts. Explicit brand.fonts.googleFonts
// always wins. Otherwise a data: stylesheet with one @import PER family and PER weight — Google's
// css2 endpoint answers 400 for the WHOLE request when any family lacks a requested weight
// (Tinos has no 500/600, Anton/Instrument Serif have only 400), which used to silently kill every
// font of the brand at once. Isolated imports fail one at a time; Chromium picks the nearest
// weight it did get.
export function googleFontsUrl(fonts = {}, exclude = new Set()) {
  if (fonts.googleFonts) return fonts.googleFonts;
  // `<role>Weight` keys are weight hints, not families (see {{weight:role}} in render.mjs)
  const families = [...new Set(Object.entries(fonts).filter(([k, v]) => k !== 'googleFonts' && k !== 'files' && !/Weight$/.test(k) && typeof v === 'string').map(([, v]) => cleanFontName(v)).filter(Boolean))]
    .filter((f) => !exclude.has(f.toLowerCase())); // families the brand ships as files are not fetched from Google
  if (!families.length) return '';
  const imp = (f, w) => `@import url("https://fonts.googleapis.com/css2?family=${encodeURIComponent(f).replace(/%20/g, '+')}${w ? `:wght@${w}` : ''}&display=swap");`;
  const css = families.map((f) => imp(f) + imp(f, 700) + imp(f, 300) + imp(f, 500) + imp(f, 600)).join('');
  return `data:text/css;charset=utf-8,${encodeURIComponent(css)}`;
}

// ~20 generic image effects (CSS filter presets). Shared by the AI and the UI.
export const EFFECTS = {
  none: '', grayscale: 'grayscale(1)', sepia: 'sepia(.7)', invert: 'invert(1)',
  contrast: 'contrast(1.4)', 'low-contrast': 'contrast(.75)', bright: 'brightness(1.3)', dark: 'brightness(.6)',
  saturate: 'saturate(1.7)', desaturate: 'saturate(.35)', blur: 'blur(4px)', sharpen: 'contrast(1.25) saturate(1.1)',
  warm: 'sepia(.4) saturate(1.3) hue-rotate(-15deg)', cool: 'saturate(1.1) hue-rotate(180deg)',
  duotone: 'grayscale(1) contrast(1.2) sepia(.6) saturate(4) hue-rotate(5deg)',
  fade: 'contrast(.85) brightness(1.1) saturate(.8)', noir: 'grayscale(1) contrast(1.5) brightness(.9)',
  vivid: 'saturate(1.9) contrast(1.15)', 'hue-shift': 'hue-rotate(90deg)', dreamy: 'blur(1px) brightness(1.1) saturate(1.3)',
};

const rotCss = (b) => (b.rot ? `transform:rotate(${b.rot}deg);` : '');
const filterCss = (b) => { const f = EFFECTS[b.effect] || ''; return f ? `filter:${f};` : ''; };

// CSS for an accent bar. `col` = how a color token is written: the render path passes
// `{{accent}}` (resolved by the brand at render time), the studio's live editor passes
// `var(--accent)` (resolved by CSS vars). Exported so the studio reuses this instead of a copy.
export function barCss(b, col = `{{${b.color}}}`) {
  const rad = b.radius ? `border-radius:${b.radius}px;` : '';
  switch (b.bstyle) {
    case 'line': return `width:${b.w}px;height:3px;background:${col};${rad}`;
    case 'block': return `width:${b.w}px;height:${b.h}px;background:${col};${rad}`;
    case 'vertical': return `width:${b.h}px;height:${b.w}px;background:${col};${rad}`;
    case 'dots': return `width:${b.w}px;height:${b.h}px;background-image:radial-gradient(${col} 42%,transparent 44%);background-size:${b.h * 1.6}px ${b.h}px;`;
    default: return `width:${b.w}px;height:${b.h}px;background:${col};${rad}`; // underline style
  }
}

// One block -> a positioned HTML element. All support `rot` (rotation). {{...}} tokens are
// resolved at render time by the brand. Types: title/kicker/text, bar, icon, logo, image, window.
function blockToEl(b) {
  const pos = `position:absolute;left:${b.x}px;top:${b.y}px;`;
  const rot = rotCss(b);

  if (b.type === 'bar') return `    <div style="${pos}${rot}${barCss(b)}"></div>`;
  if (b.type === 'rect') return `    <div style="${pos}${rot}width:${b.w}px;height:${b.h}px;background:{{${b.color}}};border-radius:${b.radius || 0}px;"></div>`;
  if (b.type === 'icon') return `    <span class="ic" style="${pos}${rot}width:${b.size}px;height:${b.size}px;color:{{${b.color}}}">{{icon:${b.icon}}}</span>`;
  if (b.type === 'logo') return `    <span style="${pos}${rot}height:${b.size}px;color:{{${b.color}}};display:flex">{{logoSvg}}</span>`;

  // Standalone image: w×h box (crop via object-fit cover + position), corners, effect, rotation.
  // `token` makes the slot dynamic: the src comes from data.<token> at render time ({{img:token}}
  // is resolved by fillTemplate); without a token the src is frozen at authoring time.
  if (b.type === 'image') {
    const rad = b.radius ? `border-radius:${b.radius}px;` : '';
    return `    <div style="${pos}${rot}width:${b.w}px;height:${b.h}px;background-color:{{surface}};background-image:url('${imgSrc(b)}');background-size:${b.fit || 'cover'};background-position:${b.bgpos || 'center'};background-repeat:no-repeat;overflow:hidden;${rad}${filterCss(b)}"></div>`;
  }

  // Retro window/frame (Hyprland/terminal look): title bar with a dot + title + _ □ ✕.
  // Holds an image (b.src / data.<token>) or stays empty. bar = title bar height.
  if (b.type === 'window') {
    const bar = b.bar || 40;
    const rad = b.radius != null ? b.radius : 14;
    const src = imgSrc(b);
    const inner = src
      ? `<div style="flex:1;background-image:url('${src}');background-size:${b.fit || 'cover'};background-position:center;${filterCss(b)}"></div>`
      : `<div style="flex:1"></div>`;
    return `    <div style="${pos}${rot}width:${b.w}px;height:${b.h}px;border:1px solid {{surface}};border-radius:${rad}px;overflow:hidden;display:flex;flex-direction:column;background:{{bg}}">
      <div style="height:${bar}px;display:flex;align-items:center;gap:10px;padding:0 14px;background:{{surface}};font-family:{{mono}};font-size:${Math.round(bar * 0.38)}px;color:{{muted}}">
        <span style="width:${Math.round(bar * 0.28)}px;height:${Math.round(bar * 0.28)}px;border-radius:50%;background:{{accent}}"></span>
        <span style="flex:1">${esc(b.title || '')}</span><span style="letter-spacing:3px">_ □ ✕</span>
      </div>${inner}
    </div>`;
  }

  // Text (title/kicker/body). Optional `w` = width (allows wrapping/horizontal resize).
  // white-space:pre-wrap matches the studio editor (.blk) so authored line breaks survive render.
  const font = b.font === 'mono' ? 'mono' : 'display';
  const content = b.token ? `{{${b.token}}}` : esc(b.text);
  const width = b.w ? `width:${b.w}px;` : '';
  return `    <div style="${pos}${rot}${width}font-family:{{${font}}};font-size:${b.size}px;font-weight:${b.weight};color:{{${b.color}}};letter-spacing:${b.ls || 0}px;line-height:1.05;white-space:pre-wrap;${b.upper ? 'text-transform:uppercase;' : ''}">${content}</div>`;
}

// Image source for image/window blocks: dynamic slot ({{img:token}}) or the static src.
const imgSrc = (b) => (b.token ? `{{img:${b.token}}}` : (b.src || ''));

// MODEL -> HTML. `model` = { dims:[w,h], blocks:[...], meta:{...} }.
export function blocksToHtml(model) {
  const { dims = [1080, 1080], blocks = [], meta = {} } = model || {};
  const [w, h] = dims;
  // embed the model; escape "<" so it doesn't close the <script> if a text contains "</script>".
  const embedded = JSON.stringify({ dims, blocks, meta }).replace(/</g, '\\u003c');
  const body = blocks.map(blockToEl).join('\n');
  return `<!doctype html>
<html lang="pt-br"><head><meta charset="utf-8">
<link href="{{googleFonts}}" rel="stylesheet">
<script type="application/json" data-ck-model>${embedded}</script>
<style>
  {{baseStyles}}
  #canvas{width:${w}px;height:${h}px;position:relative;isolation:isolate;overflow:hidden;background:{{bg}};color:{{text}};font-family:{{display}};}
</style></head>
<body>
  <div id="canvas">
    <div class="bg-photo" style="{{bgstyle}}"></div>
    <div class="bg-overlay"></div>
    <div class="bg-pattern {{patternClass}}"></div>
${body}
  </div>
</body></html>`;
}

// HTML -> MODEL. Reads the embedded model. Returns null if the template has no model (code-only).
export function htmlToBlocks(html) {
  const m = String(html).match(/<script type="application\/json" data-ck-model>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}
