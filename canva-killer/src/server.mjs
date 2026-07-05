#!/usr/bin/env node
// canva-killer — wrapper MCP.
// Expõe o core de render (src/render.mjs) como tools pra qualquer agente de IA:
//   list_brands · list_templates · render
// stdio only (é como os plugins do Claude Code sobem o servidor via .mcp.json).

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { render, renderCarousel, listBrands, listTemplates, getBrand } from './render.mjs';

// stdout é o canal do protocolo MCP no modo stdio — logs vão pro stderr.
const log = (...a) => process.stderr.write(a.join(' ') + '\n');

const server = new McpServer({ name: 'canva-killer', version: '0.1.0' });

server.tool(
  'list_brands',
  'Lista as marcas disponíveis (id + nome). Cada marca define paleta, fontes e logo usados no render.',
  {},
  async () => {
    const brands = listBrands().map((id) => {
      try { return { id, name: getBrand(id).name }; } catch { return { id }; }
    });
    return { content: [{ type: 'text', text: JSON.stringify(brands, null, 2) }] };
  }
);

server.tool(
  'list_templates',
  'Lista os templates de layout disponíveis (ex.: "post-square" = 1080x1080). O template define os campos preenchíveis.',
  {},
  async () => {
    return { content: [{ type: 'text', text: JSON.stringify(listTemplates(), null, 2) }] };
  }
);

server.tool(
  'render',
  'Gera uma arte PNG preenchendo um template com os tokens de uma marca + o conteúdo do post. Retorna o caminho do PNG. Os campos de texto (titulo, kicker, cta...) aceitam HTML inline, ex.: <span class="hl">palavra</span> pra destacar na cor de acento.',
  {
    brandId: z.string().describe('id da marca (veja list_brands)'),
    templateId: z.string().describe('id do template (veja list_templates); padrão: post-square').optional(),
    data: z.record(z.string(), z.string()).describe('conteúdo do post por campo: titulo, kicker, cta, topright, etc. Valores são string (HTML inline permitido).').optional(),
    out: z.string().describe('caminho absoluto de saída do PNG (opcional; padrão: out/<brand>-<template>.png)').optional(),
  },
  async ({ brandId, templateId, data, out }) => {
    try {
      const path = await render({ brandId, templateId, data, out });
      return { content: [{ type: 'text', text: JSON.stringify({ ok: true, path }, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

server.tool(
  'render_carousel',
  'Gera um carrossel inteiro (N slides) numa só chamada, reusando um único browser. Numera {{slide}}/{{slidetotal}} automaticamente quando o slide não traz esses campos. Retorna a lista de caminhos dos PNGs, na ordem.',
  {
    brandId: z.string().describe('id da marca (veja list_brands)'),
    templateId: z.string().describe('template do slide; padrão: carrossel-slide').optional(),
    slides: z.array(z.record(z.string(), z.string())).describe('um objeto de conteúdo por slide (titulo, kicker, corpo, cta...). slide/slidetotal são preenchidos automaticamente se ausentes.'),
    outDir: z.string().describe('pasta de saída (opcional; padrão: out/)').optional(),
    prefix: z.string().describe('prefixo dos arquivos (opcional; padrão: <brand>-carrossel)').optional(),
  },
  async ({ brandId, templateId, slides, outDir, prefix }) => {
    try {
      const paths = await renderCarousel({ brandId, templateId, slides, outDir, prefix });
      return { content: [{ type: 'text', text: JSON.stringify({ ok: true, count: paths.length, paths }, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
log('canva-killer MCP server rodando (stdio) — tools: list_brands, list_templates, render, render_carousel');
