---
name: ai-shopping
argument-hint: "<product name or listing URL>"
description: >
  Optimizes product listings to appear in AI shopping answers
  (ChatGPT, Gemini, Perplexity). Requires no external APIs.
  Triggers: "optimize for AI shopping", "appear in ChatGPT", "AI shopping",
  "optimize listing", "Gemini shopping", "Perplexity product",
  "SEO for AI", "appear when someone asks about a product".
---

# AI Shopping — Optimization for AI-Powered Search

Rewrites product listings to maximize the chance of appearing when users ask ChatGPT, Gemini, or
Perplexity for product recommendations.

## How AI Shopping Works

LLMs trained on web data recommend products based on:
- **Attribute clarity**: explicit specs, not implied ones
- **Conversational language**: how someone would describe the product to a friend
- **Comparability**: making clear in which situations this product beats alternatives
- **Structured social proof**: reviews, use cases, named target audiences
- **Schema markup**: `Product`, `Review`, `FAQPage` increase crawlability

## Flow

1. **Request the current listing** if it wasn't provided — ask for title, description, bullet
   points, and technical specs.

2. **If a voice profile exists** (either `user/plugins/<brand-id>/voice-profile.json` or `brand-profile.json` at the root), read it and apply the brand voice to the rewrite. If more than one
   `user/plugins/<brand-id>/voice-profile.json` exists and no brand was specified, ask the user
   which brand this listing belongs to instead of guessing.

3. **Analyze the current listing** and identify:
   - Implicit attributes that should be explicit
   - Vague or generic language
   - Lack of comparison with alternatives
   - Absence of specific use cases

4. **Rewrite the listing** as:

```
## Listing Optimized for AI Shopping

### Title
[Product] + [main benefit] + [differentiating attribute] — max. 80 characters

### Main Description (150–200 words)
[Conversational language. Mention who it's ideal for, the problem it solves,
and 2-3 concrete use situations. Include the product name naturally 2x.]

### Bullet Points (5–7 items)
- [Attribute]: [concrete benefit — e.g. "5000mAh battery: lasts all day without hunting for an outlet"]
...

### Who It's Ideal For
- [Profile 1]: [specific situation]
- [Profile 2]: [specific situation]
- [Not recommended for]: [use case where alternatives are better]

### Suggested FAQ (for FAQPage schema)
Q: [question someone would ask an AI about this type of product]
A: [answer that mentions the product naturally]
...
```

5. **Generate the JSON-LD schema** `Product` + `FAQPage` to paste into the page's `<head>`.

6. **Implementation checklist**:
   - [ ] Title updated
   - [ ] Description rewritten
   - [ ] JSON-LD schema added
   - [ ] FAQ published on the product page

## Notes

- Don't use empty superlatives ("best on the market", "amazing"). LLMs filter out aggressive
  marketing language.
- Specifics beat generalities — "lasts 8 hours" is better than "long-lasting".
