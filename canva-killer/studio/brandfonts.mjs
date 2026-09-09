// canva-killer studio — fonts section of the Brand tab.
// Pick fonts with your eyes, not by typing a CSS string blind: every role shows a live sample in
// the chosen family/weight, families come from a curated Google Fonts list (or any name you type,
// or a file you upload), and uploads land in user/canva-killer/fonts/<brand>/ as @font-face —
// the same files the render uses.

import { googleFontsUrl } from '/converter.mjs';

// Curated Google families that cover most brand work; anything else can still be typed.
export const FAMILIES = {
  'Sans (geometric)': ['Montserrat', 'Poppins', 'Outfit', 'Urbanist', 'Manrope', 'Plus Jakarta Sans', 'DM Sans', 'Sora', 'Lexend', 'Figtree', 'Jost', 'Josefin Sans', 'Raleway', 'Quicksand'],
  'Sans (grotesk / neutral)': ['Inter', 'Roboto', 'Work Sans', 'Space Grotesk', 'Archivo', 'IBM Plex Sans', 'Public Sans', 'Rubik', 'Karla', 'Barlow', 'Syne', 'Unbounded', 'Chivo', 'Instrument Sans'],
  'Sans (condensed / display)': ['Oswald', 'Bebas Neue', 'Anton', 'Antonio', 'Archivo Black', 'Archivo Narrow', 'Barlow Condensed', 'Saira Condensed', 'Teko', 'Big Shoulders Display', 'League Gothic'],
  'Serif (transitional / Times-like)': ['Tinos', 'Libre Baskerville', 'Lora', 'Source Serif 4', 'Crimson Pro', 'Newsreader', 'Noto Serif', 'PT Serif', 'Spectral', 'Literata'],
  'Serif (display / editorial)': ['Playfair Display', 'DM Serif Display', 'Instrument Serif', 'Cormorant Garamond', 'EB Garamond', 'Fraunces', 'Bodoni Moda', 'Italiana', 'Cinzel', 'Young Serif'],
  'Mono': ['Roboto Mono', 'JetBrains Mono', 'Fira Code', 'IBM Plex Mono', 'Space Mono', 'Anonymous Pro', 'Inconsolata', 'Source Code Pro', 'DM Mono', 'Courier Prime', 'VT323'],
  'Display / expressive': ['Pirata One', 'UnifrakturMaguntia', 'Shojumaru', 'Press Start 2P', 'Silkscreen', 'Rubik Glitch', 'Bungee', 'Monoton', 'Righteous', 'Permanent Marker', 'Caveat', 'Pacifico'],
};
const ROLE_HINT = { display: 'titles', mono: 'labels, handles, code', body: 'paragraphs', kicker: 'small caps line above the title', cta: 'calls to action', brand: 'wordmark / lockup', pixel: 'retro / pixel' };
const WEIGHTS = ['300', '400', '500', '600', '700', '800', '900'];
const GENERIC = { sans: 'system-ui, sans-serif', serif: 'serif', mono: 'ui-monospace, monospace' };

const familyOf = (stack) => { const m = String(stack || '').match(/['"]([^'"]+)['"]/); return m ? m[1] : String(stack || '').split(',')[0].trim(); };
const stackFor = (family, fallback = 'sans') => (family ? `'${family}', ${GENERIC[fallback]}` : GENERIC[fallback]);
const guessFallback = (family) => { for (const [g, list] of Object.entries(FAMILIES)) if (list.includes(family)) return g.startsWith('Serif') ? 'serif' : g === 'Mono' ? 'mono' : 'sans'; return 'sans'; };

// Load a Google family for previewing (only if the brand doesn't ship it as a file).
const loaded = new Set();
function preview(family, localFamilies) {
  if (!family || loaded.has(family) || localFamilies.has(family.toLowerCase())) return;
  loaded.add(family);
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = googleFontsUrl({ x: `'${family}'` }); document.head.appendChild(l);
}

export function renderFonts({ $, brand, container, onChange, localFamilies = new Set(), reloadFonts }) {
  const fonts = (brand.fonts ||= {});
  const roles = Object.keys(fonts).filter((k) => k !== 'googleFonts' && k !== 'files');
  if (!roles.includes('display')) roles.unshift('display');
  if (!roles.includes('mono')) roles.push('mono');
  const dl = `<datalist id="fontFamilies">${Object.entries(FAMILIES).map(([g, list]) => list.map((f) => `<option value="${f}">${g}</option>`).join('')).join('')}${[...localFamilies].map((f) => `<option value="${f}">uploaded</option>`).join('')}</datalist>`;
  const row = (role) => {
    const fam = familyOf(fonts[role]);
    const local = localFamilies.has(fam.toLowerCase());
    return `<div class="fontrow" data-role="${role}">
      <div class="row2" style="align-items:flex-end">
        <div style="flex:1.4"><label>${role}${ROLE_HINT[role] ? ` <span style="text-transform:none;letter-spacing:0">· ${ROLE_HINT[role]}</span>` : ''}</label><input class="ff" list="fontFamilies" value="${fam}" placeholder="family name"></div>
        <div style="flex:0 0 78px"><label>weight</label><select class="fw">${WEIGHTS.map((w) => `<option${(fonts[`${role}Weight`] || '400') === w ? ' selected' : ''}>${w}</option>`).join('')}</select></div>
        ${['display', 'mono'].includes(role) ? '' : '<button class="act ghost rm" style="flex:0 0 34px;padding:8px 0" title="remove role">✕</button>'}
      </div>
      <div class="fsample" style="font-family:${fonts[role] || GENERIC.sans}">Aa Bb 0123 — ${brand.name || 'Sample'}${local ? ' <span class="m">· from file</span>' : ''}</div>
    </div>`;
  };
  container.innerHTML = `${dl}<label style="margin-top:0">Fonts</label>
    <p class="hint" style="margin:0 0 6px">Type or pick a family; the sample updates live. Upload the brand's real files for exact fidelity — a Google family is always a stand-in.</p>
    <div id="fontRows">${roles.map(row).join('')}</div>
    <div class="row2" style="margin-top:8px"><input id="newRole" placeholder="new role (e.g. cta, kicker)"><button class="act ghost" id="addRole" style="flex:0 0 auto">+ role</button></div>
    <button class="act ghost" id="upFonts" style="margin-top:10px">Upload font files (.woff2 / .ttf / .otf)…</button>
    <p class="hint">Files go to <code>user/canva-killer/fonts/${brand.id}/</code> as <code>Family-Weight.woff2</code> and load as @font-face everywhere. Name them by their real family so the roles above find them.</p>`;

  const wire = () => {
    container.querySelectorAll('.fontrow').forEach((r) => {
      const role = r.dataset.role, ff = r.querySelector('.ff'), fw = r.querySelector('.fw'), sample = r.querySelector('.fsample');
      const upd = () => {
        const fam = ff.value.trim();
        preview(fam, localFamilies);
        fonts[role] = stackFor(fam, guessFallback(fam) || (role === 'mono' ? 'mono' : 'sans'));
        if (fw.value !== '400') fonts[`${role}Weight`] = fw.value; else delete fonts[`${role}Weight`];
        sample.style.fontFamily = fonts[role]; sample.style.fontWeight = fw.value;
        onChange();
      };
      ff.oninput = upd; fw.onchange = upd; sample.style.fontWeight = fw.value; preview(familyOf(fonts[role]), localFamilies);
      const rm = r.querySelector('.rm'); if (rm) rm.onclick = () => { delete fonts[role]; delete fonts[`${role}Weight`]; renderFonts({ $, brand, container, onChange, localFamilies, reloadFonts }); onChange(); };
    });
    $('#addRole').onclick = () => { const n = $('#newRole').value.trim().replace(/\W/g, ''); if (!n || fonts[n]) return; fonts[n] = GENERIC.sans; renderFonts({ $, brand, container, onChange, localFamilies, reloadFonts }); onChange(); };
    $('#upFonts').onclick = () => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.accept = '.woff2,.woff,.ttf,.otf';
      inp.onchange = async () => {
        for (const f of inp.files) {
          const b64 = btoa(String.fromCharCode(...new Uint8Array(await f.arrayBuffer())));
          await fetch('/api/upload-font', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ brandId: brand.id, name: f.name, data: b64 }) });
        }
        const local = await reloadFonts();
        renderFonts({ $, brand, container, onChange, localFamilies: local, reloadFonts });
      };
      inp.click();
    };
  };
  wire();
}
