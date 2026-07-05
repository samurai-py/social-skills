// Gera os SVGs do mascote (camaleão pixel) e do mark/favicon a partir de mapas ASCII.
// 1 caractere = 1 pixel (célula 4×4). Rodar: node gen-mascotes.mjs
// legenda: . vazio | # corpo | o branco de olho | p pupila | m boca/língua | B galho | t dedinhos | F pixel capturado
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// Regra da identidade: corpo em ESPECTRO quando nenhuma marca está carregada;
// com marca, sobrescrever --bodyfill com a cor de acento dela (os SVGs são inlináveis).
const VARIANTS = {
  'mascote-classico': [
    "...............###......",
    "..............####......",
    "..............#####.....",
    "..............###ooo....",
    "............#####oop##..",
    "...........######ooo####",
    "..........##############",
    ".........###############",
    "........###########mmmmm",
    ".......################.",
    "......###############...",
    ".....###############....",
    "....##..###########.....",
    "....#.....#.....#.......",
    "....#.....#.....#.......",
    "BBB##BBBBtBtBBBtBtBBBBBB",
    "..#..#..................",
    ".#..#.#.................",
    ".#....#.................",
    "..#..#..................",
    "...##...................",
  ],
  'mascote-chibi': [ // padrão
    ".........######.....",
    "........#######.....",
    "........#####ooo....",
    "......#######oop##..",
    ".....########ooo####",
    ".....###############",
    "....############mmmm",
    "....###############.",
    "....##############..",
    "...##############...",
    "..##..##########....",
    ".#....########......",
    ".#.....#....#.......",
    ".#.....#....#.......",
    "B#BBBBtBtBBtBtBBBBBB",
    "#..#................",
    "#..#................",
    ".##.................",
  ],
  'mascote-bolota': [
    "......######......",
    "....##########....",
    "...########ooo....",
    "..#########oop##..",
    "..#########ooo####",
    ".#################",
    ".#############mmmm",
    ".################.",
    "..###############.",
    "..##############..",
    "...############...",
    "....##########....",
    "..##..#......#....",
    ".#....#......#....",
    "B#BBBtBtBBBBtBtBBB",
    "#.##..............",
    "#..#..............",
    ".##...............",
  ],
  'mascote-esguio': [
    ".................##.......",
    "...............####.......",
    "...............#####......",
    "..............####ooo.....",
    "............######oop##...",
    "..........########ooo###..",
    ".........###############..",
    "........#############mmm..",
    ".......###############....",
    "......##############......",
    ".....############.........",
    "....##..#########.........",
    "...#.....#.....#..........",
    "...#.....#.....#..........",
    "BB##BBBBtBtBBBtBtBBBBBBBBB",
    ".#..#.....................",
    "#....#....................",
    "#..#.#....................",
    ".#..#.....................",
    "..##......................",
  ],
  'mascote-frente': [ // tela de abertura + README
    "........##........",
    ".......####.......",
    "....##########....",
    ".ooo##########ooo.",
    ".oop##########poo.",
    ".ooo##########ooo.",
    "..##############..",
    "..###mmmmmmmm###..",
    "...############...",
    "....##########....",
    "....##########....",
    "...#..######..#...",
    "...#..######..#...",
    "BBtBtBBBBBBBBtBtBB",
  ],
};

const C = 4;
const CLS = { '#': 'b', 't': 'b', 'o': 'w', 'F': 'w', 'p': 'e', 'm': 'e', 'B': 'br' };
const ORDER = ['br', 'b', 'w', 'e'];
const STOPS = '<stop offset="0%" stop-color="#ff3b3b"/><stop offset="18%" stop-color="#ff9a3b"/><stop offset="36%" stop-color="#ffe23b"/><stop offset="52%" stop-color="#3bff6e"/><stop offset="68%" stop-color="#3bd8ff"/><stop offset="84%" stop-color="#5a5aff"/><stop offset="100%" stop-color="#c23bff"/>';

for (const [name, map] of Object.entries(VARIANTS)) {
  const W = map[0].length, H = map.length;
  map.forEach((r, i) => { if (r.length !== W) throw new Error(`${name} linha ${i}: ${r.length} != ${W}`); });

  const layers = { br: [], b: [], w: [], e: [] };
  map.forEach((row, y) => [...row].forEach((ch, x) => {
    const cls = CLS[ch];
    if (cls) layers[cls].push(`<rect x="${x*C}" y="${y*C}" width="${C}" height="${C}"/>`);
  }));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W*C} ${H*C}">
<style>
  .b{fill:var(--bodyfill,url(#grad));}.e{fill:#0f0f0d;}.w{fill:#f2f2ee;}.br{fill:#45453e;}
  @media (prefers-reduced-motion: no-preference){svg{animation:hue 7s linear infinite;}@keyframes hue{to{filter:hue-rotate(360deg);}}}
</style>
<linearGradient id="grad" gradientUnits="userSpaceOnUse" x1="0" y1="${H*C}" x2="${W*C}" y2="0">${STOPS}</linearGradient>
<g shape-rendering="crispEdges">${ORDER.map(k => `<g class="${k}">${layers[k].join('')}</g>`).join('')}</g>
</svg>
`;
  writeFileSync(join(HERE, `${name}.svg`), svg);
  console.log(`${name}.svg (${W*C}×${H*C})`);
}

// mark/favicon: o quadrado que troca de cor (espectro neutro → cor da marca)
const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<style>
  .sq{fill:var(--bodyfill,url(#grad));}
  @media (prefers-reduced-motion: no-preference){svg{animation:hue 6s linear infinite;}@keyframes hue{to{filter:hue-rotate(360deg);}}}
</style>
<linearGradient id="grad" gradientUnits="userSpaceOnUse" x1="0" y1="64" x2="64" y2="0">${STOPS}</linearGradient>
<rect class="sq" x="4" y="4" width="56" height="56" rx="14"/>
</svg>
`;
writeFileSync(join(HERE, 'mark.svg'), mark);
console.log('mark.svg (favicon/quadrado)');
