---
name: static-ads
argument-hint: "[prompt | reverse <url> | history | concepts <goal>]"
description: >
  Generates static creatives for Meta Ads using FAL AI and Gemini.
  Triggers: "generate ad", "create static ad", "static ads", "generate creative",
  "Instagram ad", "feed ad", "generate stories ad",
  "reverse engineer ad", "analyze competitor ad", "ad history".
  Requires the static-ads-mcp server running locally.
---

# Static Ads — Meta Creative Generator

Generates, analyzes, and manages static creatives for Meta Ads via the `static-ads` MCP.
Visual interface available at `http://localhost:3000`.

## Prerequisites

Server running:
```bash
cd ~/path/to/static-ads-mcp
npm install
node server.js
```

## Flow by Intent

### Generate an ad

1. Use `compose_prompt` to build a prompt from the brand kit and active intelligence
2. Confirm or edit the prompt with the user
3. Ask for the size: **1:1** (feed), **9:16** (stories), **16:9** (banner), **4:5** (feed portrait)
4. Run `generate_ad` with the confirmed prompt and size
5. Return the URLs of the generated images
6. Offer: "Want a variation? Describe the adjustment."

### Reverse engineer a competitor's ad

1. Get the ad image URL
2. Run `reverse_engineer_ad` with the URL
3. Present: style prompt, why it works, 3 variants
4. Ask: "Want to use the style prompt to generate your version?"

### View history

1. Run `get_generation_history` with the active client
2. List the most recent generations with status and a summarized prompt
3. Offer to open the visual panel: `http://localhost:3000`

### Generate campaign concepts

1. Ask for the campaign objective (awareness, conversion, etc.)
2. Run `generate_concepts` with the client and objective
3. Present the 4 concepts with angle, audience, and prompt template
4. Ask which concept to run with

### List/select intelligence profiles

1. Run `list_intelligence_profiles`
2. Show the available profiles (persona, angle, hook)
3. Use the selected ID in subsequent `generate_ad` or `compose_prompt` calls

## Notes

- If the MCP doesn't respond, check that the server is running (`node server.js`)
- If `FAL_KEY` or `GEMINI_API_KEY` aren't configured, instruct the user to create the `.env`
  from `.env.example`
- The web panel at `http://localhost:3000` offers the same functionality with a visual interface
