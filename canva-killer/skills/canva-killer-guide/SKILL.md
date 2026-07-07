---
name: canva-killer-guide
description: Entry point for canva-killer — the local social-art generator. Read this FIRST whenever asked to generate/design a social post, clone a design, onboard a brand's visual identity, or do anything with canva-killer, before jumping to a specific sub-skill or calling the render MCP tool directly. Explains the system, the brand/template isolation rules, which of the 4 sub-skills to use when, and the iterate-until-good discipline every agent must follow here.
---

# canva-killer — how the whole system fits together

canva-killer turns code-based templates (HTML/CSS/SVG) into PNGs, filled per brand, driven by
any AI agent via MCP. This skill is the map — it doesn't do the work itself, it tells you which
of the other pieces does, and in what order.

## The standing rule: iterate until it's actually good

**Never ship the first render.** A template or a brand identity that "should" work often doesn't
— fonts fail to load, text overflows a guessed height, a heuristic picks the wrong color, a
layout looks nothing like the reference once real content is in it. The loop is always:

```
render -> look at the actual PNG (not just "no error thrown") -> compare against intent/reference
   -> if it's off, change something concrete (template CSS, brand palette, data) -> render again
   -> repeat until it's genuinely good, not until it merely runs
```

"No error" is not "good." Only look at the pixels tells you that. If the SAME kind of thing keeps
going wrong across different brands/templates, the bug is in a **skill's instructions or a helper
script**, not in that one attempt — fix the skill/script itself (see "Calibrate the skill, not just
the output" below), so the next agent doesn't repeat your failure.

### Calibrate the skill, not just the output
When a skill's approach fails mid-task (a heuristic gives an obviously wrong answer, an
instruction leads to a broken render), don't just patch that one output and move on — go edit the
skill's `SKILL.md` (or its helper script) with what you learned, so the failure mode is closed for
every future run, not just papered over this once. Two real examples already recorded in this
codebase's skills, as a model for what this looks like:
- `brand-identity`'s palette script originally ranked accent candidates by *area*, so a small but
  real brand-color logo mark lost to a larger, duller UI color — fixed in
  `scripts/extract-palette.mjs` and documented in `../brand-identity/SKILL.md`.
- `layout-recovery` originally suggested guessing a fixed template height, which silently clipped
  overflowing content — fixed to prefer `height:auto`, documented in `../layout-recovery/SKILL.md`.

## The MCP tools (how any agent actually renders)

- `list_brands` — brands available (id + name).
- `list_templates(brandId)` — layouts available **to that brand**: the framework's generic
  layouts (`post-square`, `story`, `blog-cover`, `carrossel-slide`) plus any template authored
  exclusively for `brandId`. Always pass `brandId` — this is how brand-scoping works, see below.
- `render(brandId, templateId, data)` — fills the template's `{{tokens}}` with the brand's
  palette/fonts/logo + the post content, exports a PNG. Returns the file path — **read that PNG
  before declaring success**, per the iteration rule above.
- `render_carousel(brandId, templateId, slides)` — same, for N slides in one browser session.

CLI equivalent for local iteration during development: `node src/render.mjs --brand <id>
--template <id> --data <file.json> --out <path>`.

## Brand and template isolation — the rule that must never be violated

Brands, templates, and custom icons/logos resolve by **overlay**: `user/canva-killer/` (real,
private data) is checked first, `canva-killer/` (public framework) is the fallback. Within that:

- **Brands** (`brands/<id>.json`) are always one file = one namespace. No leak risk here.
- **Templates** and **custom icons/logos** are **brand-scoped**: a brand only ever sees the
  framework's generic layouts/icons plus its **own** exclusive folder —
  `user/canva-killer/templates/<brandId>/` and `user/canva-killer/assets/custom/<brandId>/`.
  `<brandId>` MUST match the brand's real `id` field exactly, or the isolation silently breaks
  (a misspelled folder name just falls through to "not found," which can look like "must be
  generic" instead of the mismatch it actually is).
- **Never** save a template or custom icon meant for one specific brand flat into
  `user/canva-killer/templates/` or `.../assets/custom/` without the brand subfolder — that
  makes it visible to *every* brand. This exact bug existed in this codebase before being fixed;
  don't reintroduce it.

## Which sub-skill do I need?

```
Does the brand already have user/canva-killer/brands/<id>.json with a real palette/fonts?
 NO  -> brand-identity (learns palette/fonts/logo/pattern from reference images, writes brand.json)
 YES -> do you need to clone a SPECIFIC existing design's layout (not just its colors)?
         YES -> layout-recovery (reverse-engineers one design into templates/<brandId>/<name>.html)
         NO  -> do you just need one custom icon/mark, or just the fonts fixed?
                 icon/mark only -> svg-builder
                 fonts only     -> font-builder
                 neither        -> you already have everything; just call `render` with an
                                    existing template (generic or brand-exclusive)
```

- [`../brand-identity/SKILL.md`](../brand-identity/SKILL.md) — brand onboarding from images (palette, fonts, logo, pattern). Entry point for a new brand.
- [`../layout-recovery/SKILL.md`](../layout-recovery/SKILL.md) — clone one existing design's layout/composition into a template. Requires the brand identity to already exist.
- [`../font-builder/SKILL.md`](../font-builder/SKILL.md) — fonts only, standalone or called by the two above.
- [`../svg-builder/SKILL.md`](../svg-builder/SKILL.md) — icons/marks only, standalone or called by the two above.

## Studio (human-in-the-loop alternative)

`npm run studio` (`canva-killer/studio/`) — a local visual editor for the same data (Compose /
Create-edit / Brand tabs). Useful when a human wants to tweak by hand instead of an agent
iterating blind; it enforces the same brand-scoping rules as the MCP tools (same underlying
`src/render.mjs` functions), so nothing done there can leak across brands either.
