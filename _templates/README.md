# _templates/ — how to create real implementations

This repo is a **content skills marketplace organized by brand**. Each brand is a plugin; each
channel (LinkedIn, Instagram, blog, TikTok…) is a skill inside that plugin. Image art comes from
[`canva-killer`](../canva-killer/) (code-based templates → PNG, drivable via MCP).

These templates exist so an **AI agent can generate the real implementations by talking with the
user**. The flow below is the script the agent follows.

---

## Creating a NEW BRAND (plugin)

1. Copy `_templates/brand-plugin/` → `user/plugins/<brand>/` (a brand is user data — it lives in
   `user/`, gitignored, never published).
2. Edit `user/plugins/<brand>/.claude-plugin/plugin.json`: `name`, `description`, `author`, and
   the `skills` list (one `./<channel>` per channel). Add the entry to
   `.claude-plugin/marketplace.json` with `source: "./user/plugins/<brand>"`.
3. Ask the user about the brand's identity (what it is, audience, tone, what it would never say)
   — this becomes the basis for the channels' style guides.
4. If the brand has more than one facet/voice (e.g. a sub-brand), create separate skills per
   voice.

## Creating a NEW CHANNEL (skill) inside a brand

1. Copy `_templates/channel-skill/` → `user/plugins/<brand>/<channel>/`.
2. In `SKILL.md`: replace `CANAL` and `MARCA`, adjust the `description`'s **triggers** and the
   **format rules** for the real channel (limits, fold, hashtags, media). Format reference:
   - **LinkedIn**: plain text, ~210-char hook, target 900-1500, max 3000, 3-5 hashtags.
   - **Instagram**: caption + visual concept, ~125-char fold, max 2200, 5-15 hashtags, link in bio.
   - **TikTok**: script (2s hook + scenes) + short hook-first caption, max 2200.
3. Add `"./<channel>"` to the brand's `plugin.json` `skills` list.
4. Ask the user for **samples** and drop them in `samples/`. Run the `SKILL.md`'s "Learn the
   style" step to fill in `reference/style-guide.md`. Without samples, the style comes out
   generic — warn about that.
5. If the brand validates post length, make sure there's a `.mcp.json` at the plugin root
   pointing to the `content` server (tool `check_post_length`) via
   `${CONTENT_MCP_PATH}/server.js` — export that env var in your shell pointing to a local
   checkout of `content-mcp` (outside this repo).

## Creating a BRAND in canva-killer (palette/fonts/logo for the art)

1. Copy `canva-killer/brands/_TEMPLATE.json` → `user/canva-killer/brands/<id>.json` and fill it
   in (see `canva-killer/brands/README.md`). A real brand is user data — it lives in the `user/`
   overlay.
2. Need a new layout? Copy `canva-killer/templates/_TEMPLATE.html` →
   `user/canva-killer/templates/<id>.html` (keep a `#canvas` at the target size). Only goes into
   `canva-killer/templates/` (the framework) if it's a generic base layout reusable by any
   brand — not something authored for one specific brand.
3. Generate art via the CLI (`node src/render.mjs --brand <id> --template <id> --data
   <file.json>`) or via the `render` MCP tool. Rendering resolves brand/template/custom-icon by
   **overlay**: it looks in `user/canva-killer/` first, then falls back to the framework.

---

## Conventions

- `samples/` and `tmp/` are **gitignored** (content/drafts don't go into git).
- Channel skills always follow: **samples → distill style guide → Claude writes in the voice →
  validate length** (`check_post_length`).
- Everything user-specific/generated — brand plugins, real brands, canva-killer's authored
  assets/templates, exported PNGs — lives in `user/` (gitignored, never published). What's
  framework (`marketing-tools/`, `canva-killer/{src,studio,base templates,_TEMPLATE}`,
  `_templates/`) stays public.
- Files/folders starting with `_` are skeletons/infra, not real implementations.
