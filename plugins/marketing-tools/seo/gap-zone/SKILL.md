---
name: gap-zone
argument-hint: "<domain or site URL>"
description: >
  Use to find keywords in the "gap zone" — positions 5 to 20 in
  Google Search Console. These are the keywords closest to page 1.
  Triggers: "gap zone", "keywords almost on page 1",
  "keywords position 5 to 20", "SEO opportunities in GSC",
  "what to push into the top 5".
---

# Gap Zone — Keywords One Article Away From Page 1

Identifies the biggest ranking opportunities by connecting to Google Search Console and
filtering keywords in positions 5–20.

## Prerequisites

- AdsAgent MCP configured with a valid `ADSAGENT_API_KEY` in `.mcp.json`
- Site verified in Google Search Console

## Flow

1. **Connect to GSC** via the AdsAgent MCP. Request data for the last 90 days for the given
   domain.

2. **Filter the gap zone**: average position between 5.0 and 20.0, with at least 100 impressions
   in the period.

3. **Calculate priority** for each keyword:
   - **High**: position 5–10, impressions > 1000
   - **Medium**: position 5–10, impressions 100–1000, or position 10–15 with impressions > 500
   - **Low**: remaining cases within the zone

4. **Generate Opportunity Cards** in the format below for the top 10 by priority:

```
## [Keyword]
- Current position: X.X | Impressions (90d): X | Clicks (90d): X | CTR: X%
- Priority: High / Medium / Low
- Recommended action: [a specific action — e.g. "Add an H2 section answering 'how to do X'" or "Rewrite meta title with an intent modifier"]
```

5. **Executive summary** at the end:
   - Total keywords in the gap zone
   - Estimated additional click potential if the top 5 move to position ≤ 4
   - Suggested next step: `Use /marketing-tools:competitor-analysis <keyword> to understand why competitors are ahead`

## Notes

- Focus on keywords with informational or commercial intent — ignore branded queries.
- If the user doesn't provide a domain, ask before connecting to GSC.
- If the MCP isn't configured, instruct: "Set up ADSAGENT_API_KEY in .mcp.json and register the site in Google Search Console before using this skill."
