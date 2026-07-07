---
name: CHANNEL
description: Writes a CHANNEL post in BRAND's voice, in the platform's native format, ready to publish. Use when the user asks to write/generate a CHANNEL post for BRAND. (REPLACE CHANNEL and BRAND, and adjust the triggers.)
---

# CHANNEL writer — BRAND

<!--
  Channel skill SKELETON. Copy this folder to plugins/<brand>/<channel>/ and edit:
  - Replace CHANNEL and BRAND throughout the file.
  - Adjust the FORMAT RULES for the real channel (limits, fold, hashtags, media).
  - Leave reference/style-guide.md as "_(to be defined)_" until you have samples.
  Pattern followed by every skill in this repo: samples -> distill style guide -> Claude writes
  in the voice -> validate length via the check_post_length MCP tool.
-->

You (Claude) write the post **yourself**, in BRAND's voice (see `reference/style-guide.md`).
Paths are relative to this skill's folder.

## Flow when invoked

### 1. Understand the request
Get the **topic** and **goal**. If missing, ask.

### 2. Load the Brand Voice Profile & Stylistic Guide (Two-Tiered Data Flow)
- **Layer 1: Editorial Pillars & Arguments** (What to say): Read `voice-profile.json` (located in the parent brand directory `user/plugins/<brand-id>/voice-profile.json` or root fallback). Internalize the brand's stances, target reader pain points, values, and core theses.
- **Layer 2: Style & Platform Tone** (How to say it): Read `reference/style-guide.md` (local to this channel folder) and the samples in `samples/*.md` / `*.txt` to adopt the specific author slang, vocabulary, and formatting rhythm. If `style-guide.md` is empty, run the "Learning the style" flow below.

### 3. Write in CHANNEL's native format
<!-- Adjust these rules for the real channel. Examples:
  LinkedIn: plain text, ~210-char hook, target 900-1500, max 3000, 3-5 hashtags.
  Instagram: caption + visual concept, ~125-char fold, max 2200, 5-15 hashtags, link in bio.
  TikTok: script (2s hook + scenes) + short hook-first caption. -->
- Format rule 1
- Format rule 2

### 4. (Optional) Generate the art with canva-killer
If the channel is visual, write a short **title** and call the `render` MCP tool (`canva-killer`
server) with `{ brandId, templateId, data: { titulo, kicker, cta, ... } }` — returns the PNG.
See `canva-killer/README.md`.

### 5. Show, adjust, and deliver
Iterate until approved. Save to `tmp/<slug>.txt` (gitignored) and validate length with the
`check_post_length` MCP tool (`content` server) with `{ "text": "<text>", "platform": "CHANNEL" }`.

## Learning the style (distilling the guide)
1. Read the samples in `samples/`.
2. Fill in `reference/style-guide.md`: tone, hook, format, topics, what to avoid, 2-3 real
   references. Quote real lines.
3. Without samples, warn that the style will come out generic and ask for examples in `samples/`.
