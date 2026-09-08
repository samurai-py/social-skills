// canva-killer studio — INSPECT & ADJUST mode for code templates.
//
// The agent writes templates as HTML/CSS (that's the point of the product). A human still needs
// to nudge things without asking: move a title 20px, shrink a kicker, swap a color token, hide
// a handle. This module renders the filled template in an iframe, lets you click any element,
// edit a small set of visual properties, and saves the result as an OVERRIDES block inside the
// template file itself:
//
//   <style data-ck-overrides>
//   #canvas > .stack > .title{transform:translate(0px,20px);font-size:80px;}
//   #canvas > .lockup .handle{display:none;}
//   </style>
//
// Selectors are structural paths (#canvas > .a > .b) so the agent can read them, and colors are
// written back as {{tokens}} so the brand keeps driving them. Human and agent edit the same file.

const PROPS = [
  ['font-size', 'Font size (px)', 'number'],
  ['font-weight', 'Weight', 'select', ['', '300', '400', '500', '600', '700', '800', '900']],
  ['letter-spacing', 'Letter spacing (px)', 'number'],
  ['line-height', 'Line height', 'number'],
  ['width', 'Width (px)', 'number'],
  ['opacity', 'Opacity (0-1)', 'number'],
  ['text-align', 'Align', 'select', ['', 'left', 'center', 'right']],
  ['color', 'Color', 'token'],
  ['background', 'Background', 'token'],
];
const TOKENS = ['', 'text', 'accent', 'accent2', 'muted', 'surface', 'bg', 'transparent'];
const UNIT = { 'font-size': 'px', 'letter-spacing': 'px', width: 'px' };

export function initInspect({ $, st, getComposeData, onStatus }) {
  const state = { active: false, sel: null, overrides: {}, frame: null, hover: null, box: null, tpl: null, dirty: false };

  // ---- selector path: #canvas > .cls > .cls:nth-of-type(n) ----
  function selectorFor(el, root) {
    const parts = [];
    let cur = el;
    while (cur && cur !== root) {
      let part = cur.id ? `#${cur.id}` : (cur.classList[0] ? `.${cur.classList[0]}` : cur.tagName.toLowerCase());
      const parent = cur.parentElement;
      if (parent && !cur.id) {
        const same = [...parent.children].filter((c) => (cur.classList[0] ? c.classList.contains(cur.classList[0]) : c.tagName === cur.tagName));
        if (same.length > 1) part += `:nth-of-type(${[...parent.children].filter((c) => c.tagName === cur.tagName).indexOf(cur) + 1})`;
      }
      parts.unshift(part);
      cur = parent;
    }
    return '#canvas > ' + parts.join(' > ');
  }

  // ---- overrides <-> CSS ----
  function toCss(ov, tokenize) {
    return Object.entries(ov).map(([sel, props]) => {
      const decl = [];
      const [dx, dy] = props.translate || [0, 0];
      if (dx || dy) decl.push(`transform:translate(${dx}px,${dy}px)`);
      for (const [k, v] of Object.entries(props)) {
        if (k === 'translate' || v === '' || v == null) continue;
        if (k === 'hidden') { if (v) decl.push('display:none'); continue; }
        if ((k === 'color' || k === 'background') && v !== 'transparent') decl.push(`${k}:${tokenize ? `{{${v}}}` : (st.brand.palette[v] || v)}`);
        else decl.push(`${k}:${v}${UNIT[k] && !String(v).endsWith('px') ? UNIT[k] : ''}`);
      }
      return decl.length ? `${sel}{${decl.join(';')};}` : '';
    }).filter(Boolean).join('\n');
  }
  function parseCss(css) {
    const ov = {};
    for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const sel = m[1].trim(); const props = {};
      for (const d of m[2].split(';')) {
        const i = d.indexOf(':'); if (i < 0) continue;
        const k = d.slice(0, i).trim(), v = d.slice(i + 1).trim();
        if (k === 'transform') { const t = v.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/); if (t) props.translate = [+t[1], +t[2]]; }
        else if (k === 'display' && v === 'none') props.hidden = true;
        else if (k === 'color' || k === 'background') { const t = v.match(/^\{\{(\w+)\}\}$/); props[k] = t ? t[1] : v; }
        else props[k] = v.replace(/px$/, '');
      }
      ov[sel] = props;
    }
    return ov;
  }
  function existingOverrides(raw) {
    const m = raw.match(/<style data-ck-overrides>([\s\S]*?)<\/style>/);
    return m ? parseCss(m[1]) : {};
  }

  // ---- live apply inside the iframe ----
  function applyLive() {
    const doc = state.frame?.contentDocument; if (!doc) return;
    let styleEl = doc.getElementById('ck-live'); if (!styleEl) { styleEl = doc.createElement('style'); styleEl.id = 'ck-live'; doc.head.appendChild(styleEl); }
    styleEl.textContent = toCss(state.overrides, false);
    drawBox();
  }
  function drawBox() {
    const box = state.box; const doc = state.frame?.contentDocument;
    if (!box || !doc) return;
    const el = state.sel ? doc.querySelector(state.sel) : null;
    if (!el) { box.style.display = 'none'; return; }
    const k = +$('#inspWrap').dataset.scale || 1;
    const r = el.getBoundingClientRect();
    Object.assign(box.style, { display: 'block', left: r.left * k + 'px', top: r.top * k + 'px', width: r.width * k + 'px', height: r.height * k + 'px' });
  }

  // ---- props panel ----
  function showProps() {
    const box = $('#inspProps');
    if (!state.sel) { box.innerHTML = '<p class="hint">Click an element in the preview to adjust it. Arrows move (Shift = 1px), Esc deselects.</p>'; return; }
    const ov = state.overrides[state.sel] || {};
    const doc = state.frame.contentDocument; const el = doc.querySelector(state.sel);
    const cs = el ? doc.defaultView.getComputedStyle(el) : null;
    const cur = (k) => (ov[k] != null && ov[k] !== '' ? ov[k] : (cs ? String(cs.getPropertyValue(k)).replace(/px$/, '') : ''));
    let h = `<label style="margin-top:0">Selected</label><div class="hint" style="word-break:break-all;margin:0 0 8px">${state.sel.replace('#canvas > ', '')}</div>`;
    h += `<div class="row2"><div><label>Δ X (px)</label><input data-ov="tx" type="number" value="${(ov.translate || [0, 0])[0]}"></div><div><label>Δ Y (px)</label><input data-ov="ty" type="number" value="${(ov.translate || [0, 0])[1]}"></div></div>`;
    for (const [k, label, type, opts] of PROPS) {
      if (type === 'number') h += `<label>${label}</label><input data-ov="${k}" type="number" step="${k === 'opacity' || k === 'line-height' ? '0.05' : '1'}" value="${cur(k)}" placeholder="${cur(k)}">`;
      else if (type === 'select') h += `<label>${label}</label><select data-ov="${k}">${opts.map((o) => `<option value="${o}"${String(ov[k] ?? '') === o ? ' selected' : ''}>${o || '(template)'}</option>`).join('')}</select>`;
      else h += `<label>${label}</label><select data-ov="${k}">${TOKENS.map((o) => `<option value="${o}"${(ov[k] ?? '') === o ? ' selected' : ''}>${o || '(template)'}</option>`).join('')}</select>`;
    }
    h += `<label>Visibility</label><select data-ov="hidden"><option value=""${!ov.hidden ? ' selected' : ''}>shown</option><option value="1"${ov.hidden ? ' selected' : ''}>hidden</option></select>`;
    h += `<button class="act ghost" id="inspReset" style="margin-top:12px">Reset this element</button>`;
    box.innerHTML = h;
    box.querySelectorAll('[data-ov]').forEach((inp) => (inp.oninput = () => {
      const k = inp.dataset.ov; const o = (state.overrides[state.sel] ||= {});
      if (k === 'tx' || k === 'ty') { const t = o.translate || [0, 0]; t[k === 'tx' ? 0 : 1] = +inp.value || 0; o.translate = t; }
      else if (k === 'hidden') o.hidden = !!inp.value;
      else if (inp.type === 'number') { const cs2 = cur(k); o[k] = inp.value === '' || inp.value === cs2 ? '' : inp.value; }
      else o[k] = inp.value;
      state.dirty = true; applyLive(); status();
    }));
    $('#inspReset').onclick = () => { delete state.overrides[state.sel]; state.dirty = true; applyLive(); showProps(); status(); };
  }
  const status = () => onStatus && onStatus(state.dirty ? `unsaved adjustments on ${Object.keys(state.overrides).length} element(s)` : '');

  // ---- open / render ----
  async function open(templateId) {
    state.active = true; state.tpl = templateId; state.sel = null; state.dirty = false;
    const raw = await (await fetch(`/api/template?id=${encodeURIComponent(templateId)}&brand=${encodeURIComponent(st.brand.id)}`)).text();
    state.overrides = existingOverrides(raw);
    const dm = raw.match(/width:\s*(\d+)px;\s*height:\s*(\d+)px/);
    st.dims = dm ? [+dm[1], +dm[2]] : [1080, 1080];
    const html = await (await fetch('/api/preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ brandId: st.brand.id, templateId, data: getComposeData() }) })).text();
    const wrap = $('#inspWrap'); wrap.style.display = 'block'; $('#canvasWrap').style.display = 'none';
    const f = $('#inspFrame'); state.frame = f; state.box = $('#inspBox');
    f.style.width = st.dims[0] + 'px'; f.style.height = st.dims[1] + 'px';
    f.onload = () => {
      const doc = f.contentDocument;
      doc.addEventListener('click', (e) => {
        const root = doc.getElementById('canvas'); let t = e.target;
        if (!root || !root.contains(t) || t === root) { state.sel = null; drawBox(); showProps(); return; }
        while (t.parentElement && /^bg-/.test(t.className || '')) t = t.parentElement;
        state.sel = selectorFor(t, root); drawBox(); showProps(); e.preventDefault();
      }, true);
      applyLive(); showProps();
    };
    f.srcdoc = html;
    status();
  }
  function fit() { if (!state.active) return; const [w, h] = st.dims; const wrap = $('#inspWrap'); const stage = wrap.parentElement; const k = Math.min((stage.clientWidth - 48) / w, (stage.clientHeight - 48) / h, 1); wrap.style.width = w * k + 'px'; wrap.style.height = h * k + 'px'; wrap.dataset.scale = k; $('#inspFrame').style.transform = `scale(${k})`; $('#inspFrame').style.transformOrigin = 'top left'; drawBox(); }
  function close() { state.active = false; state.sel = null; $('#inspWrap').style.display = 'none'; $('#canvasWrap').style.display = ''; status(); }
  async function save() {
    const css = toCss(state.overrides, true);
    const r = await (await fetch('/api/save-overrides', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ brandId: st.brand.id, templateId: state.tpl, css }) })).json();
    if (r.ok) { state.dirty = false; status(); }
    return r;
  }
  function key(e) {
    if (!state.active || !state.sel) return false;
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return false;
    const o = (state.overrides[state.sel] ||= {}); const t = (o.translate ||= [0, 0]); const step = e.shiftKey ? 1 : 10;
    if (e.key === 'ArrowLeft') t[0] -= step; else if (e.key === 'ArrowRight') t[0] += step; else if (e.key === 'ArrowUp') t[1] -= step; else if (e.key === 'ArrowDown') t[1] += step;
    else if (e.key === 'Escape') { state.sel = null; drawBox(); showProps(); return true; }
    else return false;
    state.dirty = true; applyLive(); showProps(); status(); return true;
  }
  return { open, close, save, fit, key, get active() { return state.active; }, get dirty() { return state.dirty; } };
}
