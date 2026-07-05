---
name: brand-voice
argument-hint: "[optional: path to save the profile, default: ./brand-profile.json]"
description: >
  Use to create or update the brand voice profile.
  Triggers: "brand interview", "define brand voice", "create brand profile",
  "brand voice", "how does the brand write", "brand tone".
  Should run before content-writer.
---

# Brand Voice — Brand Interview

Run a structured interview with the user to capture the brand's identity and voice. At the end,
save the profile to `brand-profile.json` at the project root.

## Instructions

1. **Tell the user** you're going to ask 7 short questions. The answers will be used across all
   generated content.

2. **Ask the questions one at a time**, waiting for the answer before moving on:

   1. What's the brand's name and what does it sell/offer in one sentence?
   2. Who's the ideal customer? (age, role, main pain point, what they want to achieve)
   3. What are the 3 adjectives that best describe the brand's tone? (e.g. direct, empathetic, bold)
   4. What would the brand **never** say or do? (tone, words, approaches to avoid)
   5. Name a brand or content creator whose writing style you admire. Why?
   6. What's the biggest myth or objection your customers have before buying?
   7. What's the transformation the customer experiences after using your product/service?

3. **After all answers**, synthesize a profile in the JSON format below and save it to
   `brand-profile.json`:

```json
{
  "brand_name": "",
  "offer": "",
  "ideal_customer": {
    "profile": "",
    "main_pain": "",
    "desired_outcome": ""
  },
  "tone_adjectives": [],
  "avoid": [],
  "style_reference": "",
  "main_objection": "",
  "transformation": "",
  "voice_summary": "A 3-4 sentence paragraph describing how the brand writes, for whom, and with what intent."
}
```

4. **Show the generated profile** to the user and ask if they want to adjust anything before
   saving.

5. **Save the file** and confirm: `brand-profile.json saved. Use /marketing-tools:content-writer to create content in the brand voice.`

## Notes

- If `brand-profile.json` already exists, ask whether to update or replace it.
- Don't make up information — use exactly what the user answered.
- The `voice_summary` should read like an instruction for a human copywriter, not a technical
  description.
