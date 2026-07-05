# brands/

Uma marca por arquivo `<id>.json`. Copie `_TEMPLATE.json` e preencha. Arquivos começando com
`_` são ignorados pela listagem (`list_brands`).

## Campos

| Campo | O que é |
|-------|---------|
| `id` | identificador (igual ao nome do arquivo, sem `.json`) |
| `name` | nome de exibição da marca |
| `handle` | @ da marca (aparece no rodapé dos templates) |
| `logoText` | wordmark curto (topo dos templates) |
| `palette.bg` | cor de fundo do quadro |
| `palette.surface` | cor de linhas/superfícies sutis (grid) |
| `palette.text` | cor do texto principal |
| `palette.muted` | cor de texto secundário (rodapé, kicker apagado) |
| `palette.accent` | cor de destaque (highlights, barras, wordmark) |
| `fonts.display` | família do título (CSS font-family) |
| `fonts.mono` | família mono (kicker, rodapé, wordmark) |
| `fonts.googleFonts` | URL de import do Google Fonts (ou remova e use fontes do sistema) |

> Os nomes de `palette` e `fonts` são os `{{tokens}}` que os templates consomem
> (`{{bg}}`, `{{accent}}`, `{{display}}`…). Se criar um token novo na marca, pode usá-lo no
> template como `{{seutoken}}`.
