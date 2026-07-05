---
name: waste-finder
argument-hint: "<account name or ID> [--threshold: minimum spend amount]"
description: >
  Finds wasted spend in Google Ads — keywords with spend and zero
  conversions — and suggests pausing or adding them as negatives.
  Triggers: "wasted spend", "waste finder", "keywords with no conversions",
  "where am I losing money in Google Ads", "keywords to pause",
  "negative keywords", "optimize ad budget".
---

# Waste Finder — Where Your Money Is Going

Identifies keywords and search terms with spend and no return, and generates an action plan to
recover the budget.

## Prerequisites

- AdsAgent MCP configured with `ADSAGENT_API_KEY` in `.mcp.json`
- Google Ads account with data from the last 30 days

## Flow

1. **Connect to the account** via the AdsAgent MCP.

2. **Identify waste in two layers**:

   **Layer 1 — Keywords**
   - Keywords with spend ≥ threshold (default: $50) and 0 conversions in the last 30 days
   - Keywords with CPA > 3x the campaign's average CPA
   - Keywords with Quality Score ≤ 3

   **Layer 2 — Search Terms**
   - Queries that triggered ads but are clearly irrelevant to the business
   - Queries with high click volume and 0 conversions

3. **For each item found**, suggest an action:
   - **Pause**: keyword with a long history of spend and no conversions
   - **Add as negative**: irrelevant search term
   - **Adjust bid**: relevant keyword but with very high CPA (reduce bid instead of pausing)
   - **Improve landing page**: relevant keyword with good CTR but low conversion (post-click issue)

4. **Generate the report**:

```
## Waste Finder — [Account Name]
Period: last 30 days | Total spend analyzed: $X

### Waste Summary
- Spend on non-converting keywords: $X (X% of budget)
- Spend on irrelevant search terms: $X (X% of budget)
- **Total recoverable: $X/month**

### Keywords to Pause
| Keyword | Campaign | 30d Spend | Conversions | Recommendation |
|---------|----------|-----------|------------|--------------|
| ...     | ...      | $X      | 0          | Pause       |

### Search Terms to Add as Negative
| Query | Match Type | 30d Spend | Reason |
|-------|----------------|-----------|--------|
| ...   | ...            | $X      | ...    |

### Keywords for Bid Adjustment
| Keyword | Current CPA | Target CPA | Current Bid | Suggested Bid |
|---------|-----------|----------|-----------|--------------|

### Action Plan (by impact order)
1. [Immediate action — largest savings]
2. ...
3. ...

Estimated savings from applying all actions: $X/month
```

5. **Ask** if they want to apply the actions directly via MCP (pause keywords, add negatives) or
   just export the report.

## Notes

- Always confirm before pausing or adding negatives — Google Ads changes are hard to trace back
  retroactively.
- Consider seasonality: a keyword with no conversions last month may have a positive history.
