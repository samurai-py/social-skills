# brands/

One brand per `<id>.json` file. Copy `_TEMPLATE.json` and fill it in. Files starting with
`_` are ignored by the listing (`list_brands`).

## Fields

| Field | What it is |
|-------|---------|
| `id` | identifier (same as the filename, without `.json`) |
| `name` | brand's display name |
| `handle` | brand's @ (shows in the templates' footer) |
| `logoText` | short wordmark (top of the templates) |
| `palette.bg` | frame's background color |
| `palette.surface` | subtle lines/surfaces color (grid) |
| `palette.text` | main text color |
| `palette.muted` | secondary text color (footer, faded kicker) |
| `palette.accent` | highlight color (highlights, bars, wordmark) |
| `fonts.display` | title font family (CSS font-family) |
| `fonts.mono` | mono font family (kicker, footer, wordmark) |
| `fonts.googleFonts` | Google Fonts import URL (or remove it and use system fonts) |

> The `palette` and `fonts` keys are the `{{tokens}}` templates consume
> (`{{bg}}`, `{{accent}}`, `{{display}}`…). If you add a new token to the brand, you can use it
> in the template as `{{yourtoken}}`.
