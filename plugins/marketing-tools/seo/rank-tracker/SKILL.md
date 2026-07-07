---
name: rank-tracker
argument-hint: "<domain> [--period: 7d|30d|90d]"
description: >
  Tracks rankings weekly via GSC and shows the position delta.
  Triggers: "track rankings", "rank tracker", "how are my rankings doing",
  "what went up this week", "position delta", "weekly SEO report",
  "check rankings in GSC".
---

# Rank Tracker — Weekly Ranking Tracker

Connects to Google Search Console, compares the current week to the previous one, and delivers a
position movement report.

## Prerequisites

- AdsAgent MCP configured with `ADSAGENT_API_KEY` in `.mcp.json`
- Site verified in Google Search Console

## Flow

1. **Connect to GSC** and pull data for two periods:
   - Current period: last 7 days
   - Previous period: the 7 days before that

2. **For each keyword** with at least 50 impressions in the current period, calculate:
   - Current position (average)
   - Previous position (average)
   - Delta = previous position − current position (positive = moved up, negative = moved down)
   - Click change (%)

3. **Organize the report into sections**:

```
## Weekly Ranking Report — [date]
Domain: [domain]
Period: [start date] → [end date]

### 🚀 Biggest Gains (Top 5)
| Keyword | Current Position | Previous Position | Delta | Clicks |
|---------|--------------|-----------------|-------|---------|
| ...     | ...          | ...             | +X    | ...     |

### 📉 Biggest Drops (Top 5)
| Keyword | Current Position | Previous Position | Delta | Clicks |
|---------|--------------|-----------------|-------|---------|
| ...     | ...          | ...             | -X    | ...     |

### 🎯 Active Gap Zone (position 5–20 — see `/marketing-tools:gap-zone` for the priority tiers and full methodology)
[Top 5 gap-zone keywords this week]

### 📊 Summary
- Keywords tracked: X
- Went up: X | Went down: X | Stable: X
- Net click gain: +/- X

### Recommended Next Steps
1. [Action based on the most significant drops]
2. [Action based on gap-zone opportunities]
```

4. **Feed the cycle**: at the end, ask if they want to run `content-writer` for a gap-zone
   keyword or one of the biggest drops.

## Notes

- If this is the first run (no previous period to compare against), generate only the current
  snapshot and note that the delta will be available next week.
- Save a snapshot to `rank-history/<domain>-[date].json` (domain slugified, e.g.
  `example-com-2026-07-07.json`) — **always include the domain**, never just the date. Two
  domains tracked on the same day would otherwise silently overwrite each other's history.
