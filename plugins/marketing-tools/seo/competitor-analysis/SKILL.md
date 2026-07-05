---
name: competitor-analysis
argument-hint: "<target keyword>"
description: >
  Use to analyze who's ahead on Google for a specific keyword
  and understand exactly why they're winning.
  Triggers: "analyze competitors", "why do they rank better",
  "competitor analysis", "scrape competitors", "what the top results do",
  "competitive SEO analysis".
---

# Competitor Analysis — Why They're Winning

Uses Apify to scrape the top 3 organic results for the keyword and returns an actionable
analysis with the exact fix for each factor.

## Prerequisites

- Apify MCP configured with a valid `APIFY_TOKEN` in `.mcp.json`

## Flow

1. **Confirm the keyword** with the user if it wasn't passed as an argument.

2. **Fetch the top 3 organic results** for the keyword via Apify (actor `apify/web-scraper` or
   `apify/cheerio-scraper`). For each result, extract:
   - URL and domain
   - Title tag and meta description
   - H1 and H2s
   - Approximate word count
   - Visible relevant internal links
   - Presence of schema markup (FAQ, HowTo, Article)
   - Load speed (if available)

3. **Analyze common patterns** across the top 3:
   - Content structure (tutorials, lists, comparisons?)
   - Modifiers used in the title (best, how to, guide, complete, 2024...)
   - Average content depth
   - Extra elements (tables, videos, calculators, tools)

4. **Generate the analysis** in this format:

```
## Competitive Analysis: "[keyword]"

### Top 3 Competitors
| # | Domain | Title | Approx. words | Schema |
|---|---------|-------|-----------------|--------|
| 1 | ...     | ...   | ...             | ...    |
| 2 | ...     | ...   | ...             | ...    |
| 3 | ...     | ...   | ...             | ...    |

### Why They're Winning

**Factor 1 — [factor name]**
What they do: ...
Exact fix for you: ...

**Factor 2 — [factor name]**
...

**Factor 3 — [factor name]**
...

### Attack Plan
1. [Specific action, high priority]
2. [Specific action, medium priority]
3. [Specific action, low priority]

Next step: Use /marketing-tools:content-writer "[keyword]" to create the article with these fixes already applied.
```

## Notes

- If Apify isn't configured, instruct the user to set up the token, and try a manual analysis by
  asking the user to paste the HTML of the top 3 results.
- Focus on **actionable** factors — ignore domain authority metrics the user doesn't control in
  the short term.
