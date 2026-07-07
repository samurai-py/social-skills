---
name: layout-recovery
description: Reverse-engineers an existing post design (image, PDF, screenshot) into a Canva Killer template, and validates the output using a closed-loop visual QA process. Use when the user wants to clone or replicate an existing design.
---

# Layout Recovery — Reverse-Engineering & Visual QA

> New to canva-killer, or unsure which skill you need? Start at
> [`../canva-killer-guide/SKILL.md`](../canva-killer-guide/SKILL.md).

Use this skill when you need to recreate an existing design layout (e.g. from an uploaded PDF, PNG, or screenshot) as a Canva Killer template. This routine prevents layout hallucinations by enforcing strict measurement and visual validation.

---

## The Recovery Pipeline

```mermaid
graph TD
    A["1. Grid Mapping & Measurement"] --> B["2. Component Scaffolding"]
    B --> C["3. Template Construction"]
    C --> D["4. Closed-Loop Visual QA"]
```

### 1. Grid Mapping & Measurement
Before writing any code, analyze the reference image and define the grid structure:
- **Canvas Size**: Identify the aspect ratio. Standard Canva Killer dimensions:
  - Square: `1080 x 1080`
  - Portrait Slide: `1080 x 1350`
  - Story: `1080 x 1920`
  - Blog Cover: `1200 x 630`
- **Coordinate Grid**: Map the elements in pixels relative to the canvas size:
  - Estimate the bounding boxes `(left, top, width, height)` of titles, kickers, images, and CTA blocks.
  - Estimate font sizes, line heights, and margins/paddings.
  - Identify background styles (colors, pattern types, overlays).

### 2. Component Scaffolding
- **Custom Icons & Backgrounds**: If the reference has specific vector decorations (e.g. borders, curves, grids), use the `svg-builder` skill to generate them and save to `user/canva-killer/assets/custom/`.
- **Typography matching**: Use the `font-builder` skill to identify display/monospace fonts from Google Fonts and update the target brand JSON file.

### 3. Template Construction
- Create the brand-specific template inside the gitignored user overlay templates folder, scoped
  to that brand: `user/canva-killer/templates/<brand-id>/<template-name>.html` — `<brand-id>`
  must match the target brand's `id` field exactly. Templates are brand-scoped: a template
  dropped flat into `user/canva-killer/templates/` (no brand subfolder) is visible to every
  brand, not just this one — never do that for a design authored to match one specific brand.
- Build the HTML container structure. Set `#canvas` to the mapped dimensions.
- Embed all static SVG assets or layouts.
- Use tokens like `{{display}}`, `{{mono}}`, `{{accent}}`, `{{surface}}`, and `{{text}}` to ensure the layout remains brand-agnostic.
- Inject text variables like `{{titulo}}`, `{{kicker}}`, `{{cta}}` to allow Compose form substitution.
- Make the template **code-only** (do NOT include the visual editor `<script type="application/json" data-ck-model>` block) if it features complex custom SVG borders, terminal windows, or dynamic scripting. This prevents visual editor saves from stripping your custom markup.

**Height**: prefer `#canvas{height:auto}` with content in normal document flow over a guessed
fixed height + `overflow:hidden`. The render engine measures `#canvas`'s real bounding box after
render and sizes the screenshot to it — a fixed height just risks silently clipping content that
runs long (confirmed on a real job-post recovery: a guessed 1520px height clipped the entire last
section off-screen with no error, only caught by looking at the render). Reserve absolute
positioning for elements that must overlap a boundary (e.g. a badge overlapping the header photo).

### 4. Closed-Loop Visual QA (Visual Validation)
Do not assume the template looks correct on the first try. You must run a validation loop:
1. **Render Test**: Run the headless renderer using the brand styles and a test JSON payload
   (`--brand` scopes template resolution to that brand's folder, same id used in step 3):
   ```bash
   node src/render.mjs --brand <brand-id> --template <template-name> --data <data-json-path>
   ```
2. **Visual Contrast & Diff**: Inspect the output PNG inside `user/canva-killer/out/` and compare it side-by-side with the original user-uploaded reference image:
   - Are the margins aligned?
   - Is the text scaling correctly without clipping?
   - Do the colors and SVG strokes match?
3. **Iterative Adjustments**: Edit the HTML template coordinate styles, run the render command again, and re-check. Repeat this loop until the visual diff is minimized and the layout matches the reference.

## See also
- [`../brand-identity/SKILL.md`](../brand-identity/SKILL.md) — run this FIRST if the target
  brand has no `brands/<id>.json` yet; this skill clones *layout*, not identity, and needs
  `{{accent}}`/`{{display}}`/etc. to already resolve to something real.
- [`../svg-builder/SKILL.md`](../svg-builder/SKILL.md) / [`../font-builder/SKILL.md`](../font-builder/SKILL.md) — sub-steps this skill calls in step 2 for decorations and typography.
