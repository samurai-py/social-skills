---
name: svg-builder
description: Generates an icon/SVG element from a text description and saves it to user/canva-killer/assets/custom/ for use in art via {{icon:custom/name}}. Use when the user asks for a custom icon/symbol/shape that doesn't exist in the library (Lucide).
---

# SVG builder — custom icons & decorations from a description

Before generating, **check if the icon already exists in the Lucide library** (~1500 icons). If it does, generate nothing — just use `{{icon:name}}` in the template (e.g. `shield`, `lock`, `bitcoin`, `eye`, `terminal`). Only generate SVG for what's genuinely **custom/bespoke** (a brand mark, a scientific illustration, a background pattern).

## Honest limit
Hand-written SVG works great for a **clean/geometric/line icon** or **mathematical vectors** (like grid networks or DNA helixes). **Complex or realistic illustration, no** — for that, use a photo (the `bgimage` slot) or ask an image generator for the art. If the request is too complex for a clean vector, say so instead of delivering something bad.

## Two SVG Paradigms in Canva Killer

1. **Standard Line Icons (Lucide Style)**:
   - Used for small UI icons (e.g., in a header or inline next to text).
   - ViewBox must be `0 0 24 24`.
   - Use `stroke="currentColor"` and `fill="none"` or `fill="currentColor"` (solid parts) — never use hardcoded colors. This ensures it inherits color from the container's CSS.
   - Use standard stroke style: `stroke-width="1.7-2"`, `stroke-linecap="round"`, `stroke-linejoin="round"`.
   - No fixed `width`/`height` in the root `<svg>` tag (render strips them) — size comes from the container.

2. **Decorative Backgrounds & Technical Graphics (Custom/Complex)**:
   - Used for borders, grids, background decorations, and complex diagrams (e.g., DNA double helixes, molecular clusters).
   - Choose a viewBox matching the bounding box of your graphic (e.g., `0 0 100 1350` for a vertical border, or `0 0 500 500` for a diagram).
   - **Brand Token Interpolation**: Since custom SVG files are loaded and processed through the template rendering system, you can use brand token placeholders directly in the SVG code! E.g. `<path stroke="{{accent}}" fill="none" />` or `<circle fill="{{muted}}" />`. These tokens are dynamically replaced at render time with the active brand's colors!

## SVG Math Patterns & Templates

Use the following mathematical formulas and templates to build clean and premium vector elements:

### A. Vertical DNA Double Helix (Portrait Side Border)
A vertical double helix consists of two out-of-phase sine waves (represented by smooth quadratic Beziers) and horizontal base pairs (rungs) connecting them:

- **ViewBox**: `0 0 80 1350` (ideal for height 1350px, width 80px).
- **Helix Period**: Completes a full loop every 150px vertically.
- **Cross-Over Points**: y = 75, 150, 225, 300, etc. (at x = 40).
- **Peak Width**: Amplitude is 20px, so waves peak at x = 20 and x = 60 at y = 37.5, 112.5, 187.5, etc.

#### Strand 1 (Sine Wave)
```xml
<path d="M40,0 Q80,37.5 40,75 T40,150 T40,225 T40,300 T40,375 T40,450 T40,525 T40,600 T40,675 T40,750 T40,825 T40,900 T40,975 T40,1050 T40,1125 T40,1200 T40,1275 T40,1350" fill="none" stroke="{{accent}}" stroke-width="2.5" stroke-linecap="round"/>
```

#### Strand 2 (Out-of-Phase Sine Wave)
```xml
<path d="M40,0 Q0,37.5 40,75 T40,150 T40,225 T40,300 T40,375 T40,450 T40,525 T40,600 T40,675 T40,750 T40,825 T40,900 T40,975 T40,1050 T40,1125 T40,1200 T40,1275 T40,1350" fill="none" stroke="{{accent}}" stroke-width="2.5" stroke-linecap="round" opacity="0.4"/>
```

#### Base Pairs (Rungs)
Use a single path to render all horizontal connecting lines to keep the file compact:
```xml
<path d="M25,18.75 L55,18.75 M20,37.5 L60,37.5 M25,56.25 L55,56.25 M25,93.75 L55,93.75 M20,112.5 L60,112.5 M25,131.25 L55,131.25 M25,168.75 L55,168.75 M20,187.5 L60,187.5 M25,206.25 L55,206.25 M25,243.75 L55,243.75 M20,262.5 L60,262.5 M25,281.25 L55,281.25 M25,318.75 L55,318.75 M20,337.5 L60,337.5 M25,356.25 L55,356.25 M25,393.75 L55,393.75 M20,412.5 L60,412.5 M25,431.25 L55,431.25 M25,468.75 L55,468.75 M20,487.5 L60,487.5 M25,506.25 L55,506.25 M25,543.75 L55,543.75 M20,562.5 L60,562.5 M25,581.25 L55,581.25 M25,618.75 L55,618.75 M20,637.5 L60,637.5 M25,656.25 L55,656.25 M25,693.75 L55,693.75 M20,712.5 L60,712.5 M25,731.25 L55,731.25 M25,768.75 L55,768.75 M20,787.5 L60,787.5 M25,806.25 L55,806.25 M25,843.75 L55,843.75 M20,862.5 L60,862.5 M25,881.25 L55,881.25 M25,918.75 L55,918.75 M20,937.5 L60,937.5 M25,956.25 L55,956.25 M25,993.75 L55,993.75 M20,1012.5 L60,1012.5 M25,1031.25 L55,1031.25 M25,1068.75 L55,1068.75 M20,1087.5 L60,1087.5 M25,1106.25 L55,1106.25 M25,1143.75 L55,1143.75 M20,1162.5 L60,1162.5 M25,1181.25 L55,1181.25 M25,1218.75 L55,1218.75 M20,1237.5 L60,1237.5 M25,1256.25 L55,1256.25 M25,1293.75 L55,1293.75 M20,1312.5 L60,1312.5 M25,1331.25 L55,1331.25" fill="none" stroke="{{muted}}" stroke-width="1.5" opacity="0.4"/>
```

### B. Hexagon Cluster / Molecular Node Network
To draw regular hexagons (where the side length is $R$, vertical height is $\sqrt{3}R$):
- **Hexagon Path**: `d="M cx-R,cy L cx-R/2,cy-H L cx+R/2,cy-H L cx+R,cy L cx+R/2,cy+H L cx-R/2,cy+H Z"` (where $H = 0.866R$).

#### Example Corner Network:
```xml
<g opacity="0.35">
  <line x1="50" y1="50" x2="100" y2="20" stroke="{{surface}}" stroke-width="1.5"/>
  <line x1="100" y1="20" x2="150" y2="50" stroke="{{surface}}" stroke-width="1.5"/>
  <line x1="150" y1="50" x2="150" y2="110" stroke="{{surface}}" stroke-width="1.5"/>
  <polygon points="100,20 150,50 150,110 100,140 50,110 50,50" fill="none" stroke="{{accent}}" stroke-width="1.5" stroke-dasharray="4,4"/>
  <circle cx="100" cy="20" r="5" fill="{{accent}}"/>
</g>
```

## How to Generate & Save
1. **Understand the request**: what the icon is, whether it is line (stroke) or filled (solid), or if it is a decorative background/technical graphic.
2. **Save to private user overlay**: Always write/save the generated SVG to:
   `user/canva-killer/assets/custom/<name>.svg` (kebab-case, no accents).
   This keeps brand assets isolated from the core public framework and properly ignored by git.
3. **Render a preview to verify**: use the `render` MCP tool with a template containing an icon slot (passing `{{icon:custom/<name>}}` to it) or generate a test card to verify the rendering. Show the user.
4. **Iterate on feedback**. Once approved, the icon is available as `{{icon:custom/<name>}}` in any template.

## Using Custom Icons in Templates
- Library icons: `{{icon:shield}}` &rarr; Lucide SVG.
- Custom/bespoke icons: `{{icon:custom/pirate}}` &rarr; your generated SVG.
- The template container controls the sizing and base coloring:
  ```html
  <span class="ic" style="color: {{accent}}; width: 96px; height: 96px; display:inline-block;">{{icon:custom/pirate}}</span>
  ```
