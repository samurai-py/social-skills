---
name: ads-audit
argument-hint: "<account name or Google Ads ID>"
description: >
  Audits Google Ads account health and generates a scorecard with the 3
  highest-impact actions. Triggers: "audit Google Ads", "ads audit",
  "ad account health", "what's wrong with my ads",
  "Google Ads diagnostic", "ads scorecard".
---

# Ads Audit — Google Ads Account Diagnostic

Connects to Google Ads via the AdsAgent MCP and generates a full account health scorecard with
prioritized actions.

## Prerequisites

- AdsAgent MCP configured with `ADSAGENT_API_KEY` in `.mcp.json`
- Active Google Ads account with data from the last 30 days

## Flow

1. **Connect to the account** via the AdsAgent MCP. If there are multiple accounts, list them
   and ask the user to pick one.

2. **Collect data** from the last 30 days:
   - Active campaigns and their budgets
   - Keywords per campaign (status, match type, CPC, conversions, cost)
   - Search terms report (queries that triggered the ads)
   - Average quality scores
   - Impression share and lost IS (budget vs. rank)
   - Conversion tracking status

3. **Evaluate each dimension** with a status: ✅ OK | ⚠️ Attention | 🔴 Critical

   | Dimension | Critical Criterion |
   |----------|-----------------|
   | Conversion tracking | Less than 80% of conversions tracked |
   | Keyword health | Keywords with spend > 3x target CPA and 0 conversions |
   | Search term quality | > 20% of spend on irrelevant queries |
   | Impression share | Losing > 30% to budget on profitable campaigns |
   | Spend efficiency | More than 15% of budget on non-converting terms |
   | Ad relevance | Average quality score < 5 |

4. **Generate the Scorecard**:

```
## Ads Audit — [Account Name]
Period: last 30 days | Total spend: $X | Conversions: X | Avg. CPA: $X

### Scorecard
| Dimension              | Status | Summary                          |
|-----------------------|--------|---------------------------------|
| Conversion tracking   | ✅/⚠️/🔴 | ...                          |
| Keyword health        | ...    | ...                             |
| Search term quality   | ...    | ...                             |
| Impression share      | ...    | ...                             |
| Spend efficiency      | ...    | ...                             |
| Ad relevance          | ...    | ...                             |

### Top 3 Highest-Impact Actions
1. 🔴 [Action] — Estimated savings/gain: $X/month
2. ⚠️ [Action] — Estimated savings/gain: $X/month
3. ⚠️ [Action] — Estimated savings/gain: $X/month

### Breakdown
[Expanded section for each critical or attention item]
```

5. **Ask** if they want to run `waste-finder` to break down wasted spend by keyword.

## Notes

- If the MCP isn't configured, instruct the user to set up `ADSAGENT_API_KEY` in `.mcp.json`.
- Save the result to `ads-audit-<account>-[date].json` (account name/ID slugified) — **always
  include the account**, never just the date. Two accounts audited on the same day would
  otherwise silently overwrite each other's saved result.
