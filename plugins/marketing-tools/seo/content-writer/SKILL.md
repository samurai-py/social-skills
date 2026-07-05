---
name: content-writer
argument-hint: "<target keyword> [type: article|landing|product]"
description: >
  Writes full content in the brand voice using brand-profile.json.
  Triggers: "write article", "create content", "content writer",
  "write post", "create landing page", "write in the brand voice",
  "generate SEO content".
  Requires brand-profile.json — run /marketing-tools:brand-voice first.
---

# Content Writer — Content in the Brand Voice

Writes articles, landing pages, and product descriptions using the voice profile saved in
`brand-profile.json`.

## Prerequisites

`brand-profile.json` must exist in the project. If it doesn't, say: "Run
/marketing-tools:brand-voice first to create the brand profile."

## Flow

1. **Read `brand-profile.json`** — internalize the `voice_summary`, tone, ideal customer, and
   transformation.

2. **Confirm the parameters** if they weren't passed:
   - Target keyword (required)
   - Content type: blog article, landing page, or product description (default: article)
   - Desired length: short (~600 words), medium (~1200), long (~2500) (default: medium)
   - Is there competitor analysis available? (optional — if so, ask them to paste it or
     reference the last `competitor-analysis` result)

3. **Write the content** following these voice rules:
   - Use the tone adjectives from the profile — never stray from them
   - Speak directly to the `ideal_customer.profile`
   - Address the `main_objection` at some point in the content
   - End with the `transformation` as a vision of the future
   - Avoid everything listed in `avoid`
   - Draw inspiration from `style_reference` but don't copy it

4. **Structure for a blog article**:
   ```
   # [H1 with keyword — direct, no empty clickbait]

   [Intro: 2-3 sentences — reader's pain point + the article's promise]

   ## [H2 — first section]
   ...

   ## [H2 — second section]
   ...

   ## [H2 — main objection addressed]
   ...

   ## Conclusion
   [Summary + clear CTA aligned with the brand's transformation]
   ```

5. **After writing**, provide:
   - Suggested title tag (≤ 60 characters, with keyword)
   - Suggested meta description (≤ 155 characters)
   - Suggested URL slug

## Notes

- Never use generic AI language ("dive into", "in today's landscape", "it's crucial").
- If the user has a `competitor-analysis` result, incorporate the identified fixes.
- Product content focuses on explicit attributes and tangible benefits (important for AI
  shopping).
