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
templates/      # 1 HTML/CSS/SVG per layout — uses brand + content {{tokens}}
content/        # sample post data (JSON)
src/render.mjs  # core: brand + template + data -> PNG (headless Chromium via Playwright)
out/            # generated PNGs (gitignored)
```

Templates use `{{token}}` placeholders. Tokens come from the brand (`{{bg}}`, `{{accent}}`,
`{{display}}`, `{{logoText}}`…) and from the post content (`{{titulo}}`, `{{kicker}}`,
`{{cta}}`…). Content fields accept inline HTML — e.g. highlighting a word with
`<span class="hl">amazing</span>`. The template's `#canvas` element defines the exported frame
(e.g. 1080×1080 for a square Instagram post).

## Usage (CLI)

```bash
npm install                       # installs playwright-core (uses the system Chrome, no browser download)
node src/render.mjs \
  --brand 4gentes \
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
- **Create / edit**: add blocks (title, kicker, text, bar with variants, icon, logo, image,
  retro window, color panel), drag with **snap-to-grid** (20px), edit props. **Opens and edits
  existing templates** (block model is embedded in the saved HTML). Background patterns render
  live on the canvas. Searchable **icon browser** (~1500 Lucide icons). Keyboard control: arrows
  move the selected block (Shift = 1px), `[`/`]` reorder the stack, Del deletes, Ctrl+D
  duplicates, Esc deselects. Exports `.html` to `templates/`.
- **Brand**: palette/fonts editor + **logo upload** + live preview; saves `brands/<id>.json`.

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
node src/render.mjs --brand 4gentes --template blog-cover --data content/post.json
# where content/post.json includes:  { "titulo": "...", "bgimage": "path/to/photo.jpg" }
```

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

Create `templates/<id>.html` with a `#canvas` element at the target size and `{{token}}`
placeholders. See `templates/post-square.html` as a reference.

## Roadmap

- [x] Render core (brand + template + data → PNG) via Playwright
- [x] Multi-brand, multi-template
- [x] **MCP wrapper** (`src/server.mjs`) — tools `list_brands`, `list_templates`, `render`
- [x] Sizes: `post-square` (1080×1080), `story` (1080×1920), `carrossel-slide` (1080×1350), `blog-cover` (1200×630 / OG)
- [x] Optional background image/photo slot — `data.bgimage` (local or URL) + overlay for legibility
- [x] Carousel helper — `renderCarousel()` (slide array → N PNGs in a single browser) + `render_carousel` MCP tool
- [x] Icons — `{{icon:shield}}` (Lucide library, ~1500) + `{{icon:custom/name}}` (generated SVGs); inherit color via `currentColor`
- [x] `svg-builder` skill — generates a custom icon/SVG element from a description → `assets/custom/`
- [x] Shared `base.css` (`partials/base.css`, injected via `{{baseStyles}}`) — reset, background layers, helpers
- [x] Procedural patterns — `data.pattern`: `grid` (default) · `dots` · `scanlines` · `mesh` · `hatch` · `noise` · `none`
- [x] Studio mode (`studio/`, `npm run studio` → http://localhost:4173) — **Compose** (auto form from tokens + live preview + PNG export) and **Create template** (magnetic snap-to-grid blocks → exports `.html`)
- [x] Keyboard control + stacking order in the block editor (arrows, `[`/`]`, Del, Ctrl+D, Esc)
- [x] SocialSkills visual identity applied to the studio (see [`identity/`](../identity/))
- [ ] Built-in icon/SVG element library (mitigates the lack of a ready-made asset catalog)

## License

MIT — see [LICENSE](../LICENSE) at the repo root.
