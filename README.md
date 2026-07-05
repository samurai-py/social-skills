# social-skills

<p align="center"><img src="identity/mascote-frente.svg" width="170" alt="SocialSkills chameleon mascot"></p>

Tired of asking AI for a design and getting back that **hideous, weird, cluttered** thing?

Tired of Canva's MCP **not being available to you**?

Yeah. That's why I built this.

**social-skills** is a marketplace of content skills for Claude Code — organized by brand —
plus **[canva-killer](canva-killer/)**, an AI-drivable social art generator. Instead of the AI
"drawing" from scratch (and producing the usual horror), it fills **code-based templates** with
**your** brand's identity — that's why the mascot is a chameleon: the platform has no color of
its own, it takes on your brand's (see [identity/](identity/)).

## The pitch

Canva has an official MCP, but the piece that matters for automation — **template autofill**
(an agent fills in title + image on its own) — is **locked behind the Enterprise plan**. Outside
of it, you're stuck assembling art by hand.

`canva-killer` democratizes that piece: an **open, local, lightweight** template autofill that
any AI agent can drive via MCP. Templates become code (HTML/CSS/SVG) instead of proprietary
files — versionable, machine-readable, editable by a human or an agent. The trade-off: you lose
Canva's giant catalog of ready-made assets; you gain full control, git, and end-to-end
automation.

The rest of the repo applies the same idea to *content*: skills that interview a brand's voice,
distill a style guide from real samples, and write posts (LinkedIn, Instagram, blog, TikTok) in
that voice — plus generic SEO/Google Ads tools.

## What's in here

```
plugins/marketing-tools/  # generic, brand-agnostic SEO/Ads skills — public
canva-killer/              # art generator: core + studio + base templates — public
identity/                   # SocialSkills' own visual identity — public
_templates/                  # skeletons for scaffolding a new brand/channel/template
user/                         # YOUR content: real brands, brand plugins, exported art — private, gitignored
```

Framework (public, versioned) = `plugins/marketing-tools/`, `canva-killer/{src, studio, base
templates, _TEMPLATE}`, `identity/`, `_templates/`. Everything specific to whoever runs the repo
— your brand's voice and channels, the real palette/logo, brand-authored templates, the PNGs
you export — stays isolated in `user/` (see [`user/` convention](#user-convention) below).

## canva-killer's two layers

`canva-killer` (see its [own README](canva-killer/README.md) for the full guide) has a local
**Studio** (`npm run studio`) with two tabs reflecting a separation of purpose:

- **Create/edit** — the **foundational** layer. Builds and edits the *layout*: blocks (title,
  kicker, text, image, retro window, color panel) dragged with snap-to-grid, becoming a `.html`
  file with the block model embedded. This is where a new template's structure gets designed.
- **Compose** — the **semantic** layer. Takes a ready template, generates a form from the
  `{{tokens}}` it exposes, and only fills in content (title, image, CTA) to export the PNG.
  This is the mode an AI agent drives to turn data into a post: no layout, just text and data.

The same `.html` feeds both tabs — editing the layout in "Create/edit" is immediately reflected
in "Compose". A `converter.mjs` bridges block-model ⇄ HTML in code, with no duplicate source of
truth.

## `user/` convention

Everything specific to whoever runs the repo — user data or generated output — lives in `user/`
(already in `.gitignore`, never committed):

```
user/plugins/<brand>/           # real brand plugins (voice, channels) — e.g. your personal brand
user/canva-killer/brands/       # real palette/fonts/logo per brand
user/canva-killer/assets/       # authored SVGs (logo, custom icons)
user/canva-killer/templates/    # templates authored for a specific brand
user/canva-killer/out/          # exported PNGs
```

`canva-killer` resolves brand/template/custom-icon by **overlay**: it looks in
`user/canva-killer/` first, then falls back to the framework underneath. This lets the same
checkout serve as both the public template (just the `_TEMPLATE`/example) and a private install
(your real data), without duplicating code or leaking real content into git history.

To create your own brand or channel, follow [`_templates/README.md`](_templates/README.md).

## Configuration

Edit `.claude-plugin/marketplace.json` to register your brand plugins (see `source:
"./user/plugins/<brand>"`). The `.mcp.json` files pointing to MCP servers outside this repo use
environment variables — export them in your shell:

```bash
export CONTENT_MCP_PATH=/path/to/your/content-mcp/checkout
export STATIC_ADS_MCP_PATH=/path/to/your/static-ads-mcp/checkout
```

API keys (AdsAgent, Apify) live in `plugins/marketing-tools/.mcp.json` as placeholders —
replace them with your own. Brand secrets (e.g. a Strapi token) live in `.env` inside the
brand's plugin under `user/` — never committed (copy the matching `.env.example`).

## License

MIT — see [LICENSE](LICENSE).
