<p align="center">
  <img src="identity/mascote-frente.svg" width="190" alt="SocialSkills chameleon mascot">
</p>

<h1 align="center">SocialSkills</h1>

<p align="center">
  <strong>AI content skills and brand-native social art, without the Canva Enterprise wall.</strong>
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-f2f2ee?labelColor=0a0a0a"></a>
  <a href="canva-killer/"><img alt="Includes canva-killer" src="https://img.shields.io/badge/includes-canva--killer-7c3aed?labelColor=0a0a0a"></a>
  <img alt="AI agent ready" src="https://img.shields.io/badge/AI%20agent-ready-22c55e?labelColor=0a0a0a">
  <img alt="Local first" src="https://img.shields.io/badge/local-first-38bdf8?labelColor=0a0a0a">
</p>

<p align="center">
  <a href="#why-it-exists">Why</a> |
  <a href="#what-you-can-build">Build</a> |
  <a href="#installation">Installation</a> |
  <a href="#repo-map">Repo map</a> |
  <a href="#roadmap">Roadmap</a>
</p>

---

SocialSkills is a local, agent-friendly content studio for people who want their AI to make
useful brand content instead of weird generic slop.

It combines two things:

- **Content skills** for Claude Code: brand voice, SEO, competitor research, Google Ads audits,
  content writing and channel-specific drafting.
- **[canva-killer](canva-killer/)**: a local social art generator where templates are code
  (HTML/CSS/SVG) and an AI agent fills them with your brand, title, image and CTA.

The mascot is a chameleon for a reason: SocialSkills has no fixed visual identity when it is
working for you. It takes on your brand's colors, fonts and voice.

> [!WARNING]
> This is built for **agentic, vision-capable models** — the agent must be able to call tools/skills on its own *and* read images directly (reference posts, logos, screenshots). A text-only model, or one that can't reliably invoke MCP tools/skills, will not work well here: brand identity extraction, font matching, and layout recovery all depend on the model actually looking at the image you give it, not guessing from a text description of it. Tested against Claude (Sonnet/Opus family), Qwen and Gemini; other agentic + vision models should work but aren't verified.

## Why it exists

Canva has an official MCP, but the automation feature that matters most for agents,
**template autofill**, is locked behind the Enterprise plan.

SocialSkills gives you the useful part locally:

| Instead of... | You get... |
|---|---|
| an AI "drawing" a random ugly post | code templates filled with real brand tokens |
| proprietary template files | HTML/CSS/SVG that can live in git |
| manual Canva assembly | MCP-drivable rendering and export |
| generic AI copy | brand voice extracted from real samples |
| one-off assets | a repeatable content pipeline |

You lose Canva's giant ready-made asset catalog. You gain control, versioning, automation and
templates your AI can actually understand.

## What you can build

### Brand-native social art

Use `canva-killer` to render Instagram posts, stories, carousel slides and blog covers from
brand JSON + template HTML + post data.

```text
brand + template + post data -> PNG
```

Templates expose `{{tokens}}`. Agents fill the tokens. Humans can still edit the template.

**Learn a brand's visual identity from images.** Hand the agent a few reference posts/banners
and the `brand-identity` skill extracts palette, fonts, logo, and background pattern into a real
`brand.json` — no manual hex-code hunting. Palette extraction is a deterministic pixel-histogram
script (not the model eyeballing colors): it separates "large flat area" colors (background,
surface) from "small but vivid" ones (a logo mark, a CTA badge) so an actual brand accent doesn't
get lost behind a duller color that just happens to cover more pixels. Once the identity exists,
`layout-recovery` can clone a *specific* design's layout on top of it, and every render after
that stays isolated to that one brand — see [`canva-killer/skills/canva-killer-guide/SKILL.md`](canva-killer/skills/canva-killer-guide/SKILL.md) for the full picture.

### Channel-aware writing

The skills under `plugins/marketing-tools/` help an agent:

- interview a brand and build a voice profile;
- write LinkedIn, Instagram, blog and TikTok-style content;
- research competitors and content gaps;
- audit Google Ads accounts and find wasted spend;
- generate Meta Ads static creatives (`static-ads`, FAL AI + Gemini);
- reuse the same brand profile across channels.

### A private content workspace

Your real brands, exported art and private channel plugins live under `user/`, which is gitignored.
The public framework stays clean; your client or personal brand data does not leak into commits.

## Installation

There are two independent pieces here, and they are not equally easy to set up — be clear with
yourself about which one you actually need before assuming "installation" means all of it.

### 1. Clone the repo

```bash
git clone <this-repo>
```

That alone is enough for the skills that need **no external API at all**: `brand-voice`,
`content-writer`, `ai-shopping` (marketing-tools), and every canva-killer skill except the actual
PNG rendering (`brand-identity`, `svg-builder`, `font-builder`, `layout-recovery` all just read
images and write files/text).

### 2. canva-killer — one local MCP server, genuinely easy

This is the part that renders PNGs. It's fully local, needs no API key, and is one real,
installable MCP server:

```bash
cd canva-killer
npm install
```

Then either drive it as an agent via the shipped `canva-killer/.mcp.json` (spawns
`node src/server.mjs` over stdio — `list_brands`, `list_templates`, `render`, `render_carousel`),
or open the human UI:

```bash
npm run studio   # http://localhost:4173
```

| Tab | Purpose |
|---|---|
| **Compose** | Fill a finished template and export PNGs |
| **Create/edit** | Build or edit the layout itself |
| **Brand** | Edit palette, fonts and logo data |

For direct rendering, see [canva-killer/README.md](canva-killer/README.md).

### 3. marketing-tools integrations — bring your own, where real APIs are involved

Only needed for `gap-zone`, `rank-tracker`, `ads-audit`, `waste-finder` (Google Search
Console/Ads), `competitor-analysis` (Apify), and `static-ads` (Meta creatives via FAL AI +
Gemini). Be honest with yourself about what's actually plug-and-play here:

- **Apify** (`competitor-analysis`) is a real, installable package —
  `npx -y @apify/actors-mcp-server`, already wired in `plugins/marketing-tools/.mcp.json`. Set
  `APIFY_TOKEN` and it works.
- **AdsAgent** (GSC + Google Ads — `gap-zone`, `rank-tracker`, `ads-audit`, `waste-finder`) and
  **static-ads-mcp** (Meta creatives) are **not** installable packages this repo ships. They're
  slots: point `ADSAGENT_MCP_PATH` / `STATIC_ADS_MCP_PATH` at your own MCP server checkout.
  Nothing renders until you bring one.

See [AGENTS.md § Configuration](AGENTS.md#configuration) for the exact env vars.

### Why this stays file-based instead of "just an MCP install"

A fair question: could this be a single easy MCP connection instead of a repo you clone and that
writes files into itself? For canva-killer specifically — no, on purpose. The templates, the
brand palettes, the exported PNGs living as real files in a real git history *is* the product:
version control on your visual identity, templates a human can open and edit, brand data that's
yours and never touches a third-party database. A stateless MCP-only version would mean either
losing that (a hosted service holding your brand config instead) or building a database-backed
product behind the MCP calls — a different tool, not a lighter install of this one. The
`canva-killer` MCP server itself is already a one-command install with zero config; the
repo-cloning and file-writing is the local-first tradeoff, not accidental complexity. What *is*
genuinely more complex than it should be is the marketing-tools side above — that complexity is
real (BYO external MCP servers), and worth being upfront about instead of implying "add API key
and go."

## Repo map

```text
plugins/marketing-tools/  # generic SEO, Ads and content skills
canva-killer/             # local art generator, Studio and MCP server
identity/                 # SocialSkills chameleon identity
_templates/               # skeletons for new brands/channels/templates
user/                     # your private brands, outputs and plugins (gitignored)
```

Framework code is public and versioned. Real user content belongs in `user/`.

## How the private overlay works

`canva-killer` resolves brands, templates and assets by overlay:

```text
user/canva-killer/...  -> checked first
canva-killer/...       -> framework fallback
```

That means one checkout can be both:

- a public framework repo with examples and templates;
- a private working studio with real brands, palettes, logos and exports.

Suggested private layout:

```text
user/plugins/<brand>/                    # real brand plugins and channel skills
user/canva-killer/brands/                # brand palette, fonts, logo, handle
user/canva-killer/assets/custom/         # generic authored SVGs/icons shared by every brand
user/canva-killer/assets/custom/<brand>/ # SVGs/logo exclusive to one brand
user/canva-killer/templates/<brand>/     # templates exclusive to one brand
user/canva-killer/out/                   # exported PNGs
```

Templates and custom assets/icons are **brand-scoped**: a brand only ever sees the framework's
generic layouts/icons plus its own `<brand>/` subfolder — never another brand's exclusive work.

To create a brand or channel, start with [_templates/README.md](_templates/README.md).

## Agent setup

Register brand plugins in:

```text
.claude-plugin/marketplace.json
```

MCP paths are configured through environment variables:

```bash
export CONTENT_MCP_PATH=/path/to/your/content-mcp/checkout
export STATIC_ADS_MCP_PATH=/path/to/your/static-ads-mcp/checkout
export ADSAGENT_MCP_PATH=/path/to/your/google-ads-and-gsc-mcp/checkout
```

`static-ads` and `adsagent` are bring-your-own MCP servers — this repo only has the env-var slot,
not the server. `apify` is the one real installable package (`@apify/actors-mcp-server`); its
token is the only actual placeholder-to-replace in `plugins/marketing-tools/.mcp.json`. See
[Installation](#installation) above for the full breakdown. Brand secrets belong in `.env` files
under `user/plugins/<brand>/`, never in git.

## Roadmap

SocialSkills is built for solo creators and tiny teams that need an AI agent to do the busywork
usually outsourced to an agency.

### Core features

- [ ] **Publisher**: connect real social accounts so the agent can publish or prepare posts for
  review. Starts as email/webhook review, then moves to official platform APIs where possible.
- [ ] **Blog automator**: connect WordPress or similar, inspect the queue, research topics and
  schedule posts as part of an editorial calendar.

### Backlog

- [ ] **Repurposing pipeline**: one long-form piece becomes a LinkedIn post, Instagram carousel
  and thread.
- [ ] **Analytics feedback loop**: pull engagement back into brand voice and content strategy.
- [ ] **Voice QA gate**: score drafts against `brand-profile.json` before publishing.
- [ ] **More exports**: PDF carousels and short animated stories.
- [ ] **Localization**: generate one campaign in multiple languages.
- [ ] **Community template gallery**: import templates from URLs or gists.
- [ ] **Mascot flourishes**: color-shifting badges, terminal banners and small chameleon touches.


## Sponsors

<p align="center">
  <a href="https://waifucorp.org">
    <img src="identity/waifucorp-logo.svg" width="250" alt="wAIfu Corp logo">
  </a>
</p>

<p align="center">
  Built with support from <a href="https://waifucorp.org/"><strong>wAIfu Corp</strong></a>.
</p>

## License

MIT - see [LICENSE](LICENSE).
