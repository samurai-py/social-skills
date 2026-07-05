# Visual identity — SocialSkills

The platform **has no color of its own**: accent elements cycle the RGB spectrum when no brand
is loaded, and take on **the user's brand accent color** as soon as one loads. The mascot is a
**pixel chameleon** — the animal that literally does this.

## Files

| File | Use |
|---|---|
| `mascote-chibi.svg` | **Default** mascot |
| `mascote-classico.svg` · `mascote-bolota.svg` · `mascote-esguio.svg` | Alternatives — the user picks one in settings |
| `mascote-frente.svg` | Studio **splash screen** and README hero (not a mascot option) |
| `mark.svg` | Mark/favicon: the square that changes color |
| `gen-mascotes.mjs` | Generator — sprites are born from ASCII maps (1 char = 1 pixel); edit the map and run `node gen-mascotes.mjs` |

The SVGs are self-contained (spectrum-animated by default). Inlined in the UI, the body recolors
via CSS: `--bodyfill: <brand color>`.

## Rules

- **Color**: spectrum cycling when neutral → solid brand color when loaded. Applies everywhere:
  mark, mascot, title bar dots, primary button, active tab.
- **Terminal buttons**: on hover they get a **colored sweep** spinning behind them
  (conic-gradient) — spectrum when neutral; monochrome in the brand's color when loaded.
- **Typography**: monospace everywhere (`ui-monospace / SF Mono / Cascadia Code / JetBrains
  Mono`). The whole UI reads like a code editor.
- **Lockup**: `[mark] SocialSkills by wAIfu Corp. × [user's logo]` (dashed placeholder when no
  logo).
- **Tokens**: bg `#0a0a0a` · panel `#121212` · line `#262624` · text `#f2f2ee` · muted `#7c7c76`
  · eye/pixel `#f2f2ee` · sprite darks `#0f0f0d` · branch `#45453e`.

## Where the mascot shows up

The mascot **is not part of the lockup** — it's a *companion*: perched on the bottom edge of the
studio header (the sprite's branch aligns with the UI's border), reflecting the loaded brand's
color. **Clicking it cycles the body** (chibi → classic → bolota → slim, persisted in
localStorage). During export it cycles colors ("thinking"). The `frente` variant appears on the
studio's splash screen and in the README.

Implemented in `canva-killer/studio/index.html` (the server exposes `GET /identity/<file>`).
