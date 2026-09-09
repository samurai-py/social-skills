# canva-killer

Social media art generator built from **code-based templates** (HTML/CSS/SVG), filled in with
a **brand** (palette + fonts + logo) and **post content** — exporting a PNG ready to publish.
Built to be driven by **any AI agent** via MCP.

## Why this exists

Canva has an official MCP, but the feature that matters for automation — **template autofill**
(the agent fills in title + image on its own) — is **locked behind the Enterprise plan**.
Outside of Enterprise, you're stuck assembling art by hand.

`canva-killer` democratizes exactly that piece: an **open, local, no-paid-plan** template
autofill that runs with any AI agent plugged in. You lose Canva's giant catalog of ready-made
assets — but you gain full control, git versioning, and end-to-end automation. For the "a few
brand templates, filled in per post" use case, that's a trade worth making.

## How it works

```
brands/         # 1 JSON per brand: palette, fonts, logo, handle
templates/      # generic layouts (HTML/CSS/SVG) — brand-agnostic, shared by every brand
content/        # sample post data (JSON)
src/render.mjs  # core: brand + template + data -> PNG (headless Chromium via Playwright)
out/            # generated PNGs (gitignored)
```

Templates are **brand-scoped**, the same overlay pattern as brands/icons: a brand always sees the
framework's generic layouts here in `templates/` (`post-square`, `story`, `blog-cover`,
`carrossel-slide`), plus any layout authored exclusively for it in
`user/canva-killer/templates/<brandId>/`. A brand never sees another brand's exclusive templates —
`listTemplates()`/`resolveTemplatePath()` in `src/render.mjs` always take a `brandId` and resolve
within that scope only.

Templates use `{{token}}` placeholders. Tokens come from the brand (`{{bg}}`, `{{accent}}`,
`{{display}}`, `{{logoText}}`…) and from the post content (`{{titulo}}`, `{{kicker}}`,
`{{cta}}`…). Content fields accept inline HTML — e.g. highlighting a word with
`<span class="hl">amazing</span>`. The template's `#canvas` element defines the exported frame
(e.g. 1080×1080 for a square Instagram post).

## Usage (CLI)

```bash
npm install                       # installs playwright-core (uses the system Chrome, no browser download)
node src/render.mjs \
  --brand mybrand \
  --template post-square \
  --data content/pirataria.json \
  # --out out/my-art.png          (optional)
```

Output: PNG in `out/` (2160×2160 by default = 1080 @2x, crisp; Instagram downsamples to 1080).

> Uses the system Chrome at `/usr/bin/google-chrome`. Override with the `CHROME_PATH` env var.

## Studio (visual editor)

```bash
npm run studio   # http://localhost:4173
```
A minimal local server that reuses `render.mjs`. Three tabs:
- **Compose**: pick brand + template, fill in the fields (form generated from the
  `{{tokens}}`), see a live preview (iframe, via `fillTemplate`), and export the @2x PNG (via
  Playwright).
- **Create / edit**: two kinds of template, one tab.
  - *Block templates* (made here): add blocks (title, kicker, text, bar, icon, logo, image, retro
    window, panel), drag with **snap-to-grid** (20px), edit props, keyboard control (arrows,
    `[`/`]`, Del, Ctrl+D, Esc). Saved as `.html` with the block model embedded, exclusive to the
    active brand.
  - *Code templates* (written by the agent, or recovered from a reference): open one and you get
    **inspect & adjust** — click any element in the rendered preview, nudge it with the arrows,
    change size/weight/spacing/width/opacity/alignment, swap its color token, hide it. **Save
    adjustments** writes a `<style data-ck-overrides>` block into the template file, with
    structural selectors and `{{tokens}}`, so the agent reads the same edits you made. Opening a
    framework skeleton and saving copies it into the brand's folder first.
- **Brand**: palette editor, **fonts with live samples** (pick from a curated Google list or type
  any family, choose the weight, add roles like `cta`/`kicker`, **upload the brand's own
  .woff2/.ttf/.otf** straight into `user/canva-killer/fonts/<brand>/`), logo upload, and a live
  preview of the *unsaved* edits on the brand's own first template; saves `brands/<id>.json`.

Text blocks in Create/edit have a **Width** (0 = auto): set it to make a title wrap. Image and
window blocks have an **Image slot token**: leave it empty for a fixed image, or name it (e.g.
`hero`) to make the slot dynamic — Compose then shows a `hero` field and an agent fills
`data.hero` per post.

**Autosave**: studio state is saved to `localStorage` every 60s (and restored on open).

## Background pattern (optional)

Pass `pattern` in `data` (or set `pattern` on the brand as a default): `grid` (default), `dots`,
`scanlines`, `mesh`, `hatch`, `noise`, `none`. Patterns live in `partials/base.css` and use the
brand's colors (`surface`/`accent`). They compose with the image slot (pattern sits on top of
the photo).

## Background image (optional)

Pass `bgimage` in `data` — a **local** path (recommended; it's embedded as a data URI, works
offline) or an **http(s) URL** (requires Chromium to have network access). Templates have an
overlay that darkens the image to keep text legible. Without `bgimage`, only the solid
background + grid show.

```bash
node src/render.mjs --brand mybrand --template blog-cover --data content/post.json
# where content/post.json includes:  { "titulo": "...", "bgimage": "path/to/photo.jpg" }
```

## Brand fonts as files (real fidelity)

Drop the brand's own font files in `user/canva-killer/fonts/<brandId>/`, named
`<Family Name>-<weight>[-italic].woff2|ttf|otf` (e.g. `Montserrat-300.woff2`). They become
`@font-face` rules in every render and in the studio, embedded as data URIs, and that family is
no longer fetched from Google Fonts. Use the role in templates as `{{font:<role>}}`. Explicit
mapping is also possible: `fonts.files: [{ family, src, weight, style }]`.

## Templates: the brand's own vs. the neutral skeletons

The four framework templates (`post-square`, `story`, `blog-cover`, `carrossel-slide`) are
**neutral skeletons**: flat, undecorated, no pattern — they show a brand's palette, fonts and
logo and nothing else. They exist so a fresh brand renders *something*; the brand's actual look
lives in `user/canva-killer/templates/<brandId>/` (recovered from its real posts or authored in
the studio). Once a brand has its own layouts, set `"genericTemplates": false` in its JSON and
the skeletons disappear from `list_templates` and from the studio for that brand. Background
patterns default to `none`; `grid` & co. are opt-in per brand or per render.

## Per-post image slots, gradient, variants

- **Image slots**: a template can declare `background-image:url('{{img:hero}}')`; `data.hero`
  (local path or URL) fills it at render time. Different from `bgimage`, which is the single
  full-bleed photo layer.
- **Optional slots**: `{{has:hero}}` is `1` when `data.hero` is set and empty otherwise — put it
  on an attribute (`<div id="canvas" data-hero="{{has:hero}}">`) and collapse the slot with CSS
  (`#canvas[data-hero=""] .hero{display:none}`) so a post without an image doesn't render a hole.
- **Carousels = a cover + a page family.** Slide 1 is the brand's cover template for that post
  type; the following slides come from a small family of page patterns (`slide-texto`,
  `slide-lista`, `slide-numero`, `slide-citacao`, `slide-imagem`, `slide-passo`, `slide-cta`),
  each with an optional image. `render_carousel` numbers them and accepts `template` per slide.
- **`{{gradient}}`**: the brand's `gradient` field, or `linear-gradient(95deg, accent, accent2)`
  when the brand doesn't declare one.
- **Variants**: a brand may carry `variants: { light: { bg, surface, text, muted, accent } }`.
  `data.variant = "light"` renders any template with that palette override.
- **Fonts**: every key under `fonts` is reachable as `{{font:<key>}}` (`{{font:body}}`,
  `{{font:cta}}`…; `{{display}}` and `{{mono}}` also work bare). All named families are loaded
  from Google Fonts automatically, one request per family (so `Tinos` lacking weight 500 no longer
  kills `Oswald` next to it), unless `fonts.googleFonts` is set explicitly.

## Adding a brand

Create `brands/<id>.json`:

```json
{
  "id": "mybrand",
  "name": "My Brand",
  "handle": "@mybrand",
  "logoText": "MY.BRAND",
  "palette": { "bg": "#080c0a", "surface": "#14201a", "text": "#e9f2ec", "muted": "#6f8279", "accent": "#3dff8f" },
  "fonts": {
    "display": "'Space Grotesk', sans-serif",
    "mono": "'JetBrains Mono', monospace",
    "googleFonts": "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@400;600&display=swap"
  }
}
```

## Adding a template

- **Generic layout** (reusable by any brand): create `templates/<id>.html` here in the framework,
  with a `#canvas` element at the target size and `{{token}}` placeholders. See
  `templates/post-square.html` as a reference.
- **Brand-exclusive layout**: create `user/canva-killer/templates/<brandId>/<id>.html` instead —
  only that brand will ever see or render it (see [`_templates/README.md`](../_templates/README.md#creating-a-brand-in-canva-killer-palettefontslogo-for-the-art)).

## Roadmap

- [x] Render core (brand + template + data → PNG) via Playwright
- [x] Multi-brand, multi-template
- [x] **MCP wrapper** (`src/server.mjs`) — tools `list_brands`, `list_templates`, `render`
- [x] Sizes: `post-square` (1080×1080), `story` (1080×1920), `carrossel-slide` (1080×1350), `blog-cover` (1200×630 / OG)
- [x] Optional background image/photo slot — `data.bgimage` (local or URL) + overlay for legibility
- [x] Carousel helper — `renderCarousel()` (slide array → N PNGs in a single browser) + `render_carousel` MCP tool
- [x] Icons — `{{icon:shield}}` (Lucide library, ~1500) + `{{icon:custom/name}}` (generated SVGs); inherit color via `currentColor`
- [x] `svg-builder` skill — generates a custom icon/SVG element from a description → `assets/custom/`
- [x] `font-builder` skill — identifies visual fonts via OCR, matches to Google Fonts, and auto-resolves stylesheets
- [x] `brand-identity` skill — learns a brand's full visual identity (palette, fonts, logo, pattern) from reference images, writes `brands/<id>.json`
- [x] `layout-recovery` skill — reverse-engineers an existing design into a template, with closed-loop visual QA
- [x] Per-brand template isolation — a brand only ever sees generic layouts + its own exclusive templates, never another brand's
- [x] Shared `base.css` (`partials/base.css`, injected via `{{baseStyles}}`) — reset, background layers, helpers
- [x] Procedural patterns — `data.pattern`: `grid` (default) · `dots` · `scanlines` · `mesh` · `hatch` · `noise` · `none`
- [x] Studio mode (`studio/`, `npm run studio` → http://localhost:4173) — **Compose** (auto form from tokens + live preview + PNG export) and **Create template** (magnetic snap-to-grid blocks → exports `.html`)
- [x] Keyboard control + stacking order in the block editor (arrows, `[`/`]`, Del, Ctrl+D, Esc)
- [x] SocialSkills visual identity applied to the studio (see [`identity/`](../identity/))
- [x] Per-post image slots (`{{img:name}}`), `{{gradient}}`, brand `variants` (`data.variant`), all `fonts.*` as tokens
- [x] Measurement scripts for the identity skills — multi-image OKLab palette extraction with contact sheet, layout measurement with gridded overlay, reference-vs-render scoring (`compare.mjs`)
- [x] Brand font files (`user/canva-killer/fonts/<brandId>/`) as `@font-face`; Google Fonts requested one family at a time
- [x] Framework templates reduced to neutral skeletons; `genericTemplates: false` hides them per brand; pattern default `none`
- [ ] Built-in icon/SVG element library (mitigates the lack of a ready-made asset catalog)

## License

MIT — see [LICENSE](../LICENSE) at the repo root.
