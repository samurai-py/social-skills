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
- `list_templates(brandId)` — layouts available **to that brand**: its own templates plus, unless
  the brand sets `"genericTemplates": false`, the framework's neutral skeletons (`post-square`,
  `story`, `blog-cover`, `carrossel-slide`). Always pass `brandId` — this is how brand-scoping
  works, see below. Prefer the brand's own templates whenever they exist.
- `render(brandId, templateId, data)` — fills the template's `{{tokens}}` with the brand's
  palette/fonts/logo + the post content, exports a PNG. Returns the file path — **read that PNG
  before declaring success**, per the iteration rule above. Reserved `data` keys: `bgimage`
  (full-bleed photo slot), `pattern`, `patternOpacity`, `variant` (a brand `variants` key, e.g.
  `"light"`), and one key per `{{img:<name>}}` image slot the template declares.
- `render_carousel(brandId, templateId, slides)` — same, for N slides in one browser session.
  Each slide may carry its own `template`: slide 1 is the brand's cover for that post type, the
  rest are pages from its family (`slide-texto`, `slide-lista`, `slide-numero`, …, `slide-cta`).

CLI equivalent for local iteration during development: `node src/render.mjs --brand <id>
--template <id> --data <file.json> --out <path>`.

## The measurement scripts (use them — don't estimate what can be measured)

| Script | What it gives you |
|---|---|
| `skills/brand-identity/scripts/extract-palette.mjs <imgs…> --sheet out.png` | roles `bg/surface/text/muted/accent/accent2` from N references, which ones are derived, WCAG contrast, warnings, a contact-sheet PNG |
| `skills/layout-recovery/scripts/measure-layout.mjs <img> --overlay out.png` | canvas format, margins, content blocks with bbox + font-size estimates, a gridded overlay PNG to read positions from |
| `skills/brand-identity/scripts/compare.mjs <reference> <render> --out out.png` | palette + geometry score of a render against its reference, verdict, side-by-side PNG |

The loop for anything that must *look like* a reference is: measure → build → render →
`compare.mjs` → fix what the verdict names → repeat until the score stops improving, then do
the final check with your own eyes on the side-by-side sheet.

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

## What do I run? — four situations

**A. First time using SocialSkills (nothing set up yet)**
1. `cd canva-killer && npm install` (once; needs a system Chrome — `CHROME_PATH` overrides
   `/usr/bin/google-chrome`).
2. Check the plumbing with the example brand: `node src/render.mjs --brand mybrand --template
   post-square --data <any small json>` → look at the PNG.
3. `npm run studio` → http://localhost:4173 to see the three tabs. Then go to **B** for the real brand.

**B. New brand (no `user/canva-killer/brands/<id>.json` yet)**
→ `brand-identity`. Ask for reference prints, **the logo file and the font files**, run
`extract-palette.mjs … --sheet`, install fonts/logo, write the brand JSON, check with
`compare.mjs` — then its step 8: recover the brand's recurring formats into
`templates/<id>/` and set `genericTemplates: false`. A brand is onboarded when it has its own
layouts, not when it has a JSON. The framework's `post-square`/`story`/`blog-cover`/
`carrossel-slide` are neutral skeletons (no decoration) meant as placeholders, not as the look.

**C. New post / new piece for an EXISTING brand**
→ no skill needed, just the tools: `list_templates(brandId)` → pick a layout → `render` (or
`render_carousel`) with `data` → look at the PNG → fix → render again. Content-only work. If the
brand needs a layout it doesn't have yet, that's **D**. Small visual nudges ("title 20px lower")
the person can do themselves in the studio's Create/edit tab on any code template; they land in
a `<style data-ck-overrides>` block you must preserve when you touch that file.

**D. New layout — clone a specific design, or author one**
→ `layout-recovery` when there is a reference to match: `measure-layout.mjs --overlay`, write
`user/canva-killer/templates/<brandId>/<name>.html`, render, `compare.mjs`, iterate. Or the
studio's **Create/edit** tab for a layout from scratch (blocks → saved HTML; give image blocks a
slot token so the agent can fill them per post). The moment a brand owns one template, the
framework skeletons disappear from its listing — from then on, its templates are the brand.

`svg-builder` (one icon/mark) and `font-builder` (fonts only) are sub-steps of B/D but work
standalone for a quick fix.


## Studio (human-in-the-loop alternative)

`npm run studio` (`canva-killer/studio/`) — a local visual editor for the same data (Compose /
Create-edit / Brand tabs). Useful when a human wants to tweak by hand instead of an agent
iterating blind; it enforces the same brand-scoping rules as the MCP tools (same underlying
`src/render.mjs` functions), so nothing done there can leak across brands either.
