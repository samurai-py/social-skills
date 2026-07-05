---
name: svg-builder
description: Generates an icon/SVG element from a text description and saves it to canva-killer/assets/custom/ for use in art via {{icon:custom/name}}. Use when the user asks for a custom icon/symbol/shape that doesn't exist in the library (Lucide).
---

# SVG builder — custom icons from a description

Before generating, **check if the icon already exists in the Lucide library** (~1500 icons). If
it does, generate nothing — just use `{{icon:name}}` in the template (e.g. `shield`, `lock`,
`bitcoin`, `eye`, `terminal`). Only generate SVG for what's genuinely **custom/bespoke** (a mark,
a brand-specific symbol).

## Honest limit
Hand-written SVG works great for a **clean/geometric/line icon**. **Complex or realistic
illustration, no** — for that, use a photo (the `bgimage` slot) or ask an image generator for
the art. If the request is too complex for a clean vector, say so instead of delivering
something bad.

## How to generate
1. Understand the request: what the icon is, and whether it's **line** (stroke) or **filled**
   (fill).
2. Write the SVG **yourself**, following these rules so it matches the library and inherits the
   brand:
   - `viewBox="0 0 24 24"` (same grid as Lucide).
   - Use **`stroke="currentColor"`** (and `fill="currentColor"` on solid parts) — never a fixed
     color. That way color comes from the container's CSS (inherits the brand's accent/text).
   - `stroke-width` ~1.7–2, `stroke-linecap="round"`, `stroke-linejoin="round"` (Lucide style).
   - No fixed `width`/`height` required (render strips them) — size comes from the container.
3. Save to `${CLAUDE_PLUGIN_ROOT}/assets/custom/<name>.svg` (kebab-case, no accents).
4. **Render a preview** to check it: use the `render` MCP tool with a template that has an icon
   slot, passing `{{icon:custom/<name>}}`, or generate a test card. Show the user.
5. Iterate on feedback. Once approved, the icon is already available as
   `{{icon:custom/<name>}}` in any template.

## Using it in templates
- Library: `{{icon:shield}}` → Lucide SVG.
- Custom: `{{icon:custom/pirate}}` → the SVG you generated.
- The container controls size and color:
  ```html
  <span class="ic" style="color: {{accent}}; width: 96px; height: 96px; display:inline-block;">{{icon:custom/pirate}}</span>
  ```
  (the injected `<svg>` fills 100% of the container when the container's CSS sets a width/height).
