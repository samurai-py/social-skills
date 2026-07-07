#!/usr/bin/env node
// canva-killer — MCP wrapper.
// Exposes the render core (src/render.mjs) as tools for any AI agent:
//   list_brands · list_templates · render
// stdio only (this is how Claude Code plugins bring up the server via .mcp.json).

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { render, renderCarousel, listBrands, listTemplates, getBrand } from './render.mjs';

// stdout is the MCP protocol channel in stdio mode — logs go to stderr.
const log = (...a) => process.stderr.write(a.join(' ') + '\n');

const server = new McpServer({ name: 'canva-killer', version: '0.1.0' });

server.tool(
  'list_brands',
  'Lists the available brands (id + name). Each brand defines the palette, fonts, and logo used when rendering.',
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
  'Lists layout templates available to a brand: the framework\'s generic layouts (post-square, story, blog-cover, carrossel-slide) plus any templates authored exclusively for that brand. Templates are brand-scoped — a brand never sees another brand\'s exclusive templates.',
  {
    brandId: z.string().describe('brand id (see list_brands)'),
  },
  async ({ brandId }) => {
    return { content: [{ type: 'text', text: JSON.stringify(listTemplates(brandId), null, 2) }] };
  }
);

server.tool(
  'render',
  'Generates a PNG art piece by filling a template with a brand\'s tokens + the post content. Returns the PNG path. Text fields (titulo, kicker, cta...) accept inline HTML, e.g. <span class="hl">word</span> to highlight in the accent color.',
  {
    brandId: z.string().describe('brand id (see list_brands)'),
    templateId: z.string().describe('template id (see list_templates); default: post-square').optional(),
    data: z.record(z.string(), z.string()).describe('post content per field: titulo, kicker, cta, topright, etc. Values are strings (inline HTML allowed).').optional(),
    out: z.string().describe('absolute output path for the PNG (optional; default: out/<brand>-<template>.png)').optional(),
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
  'Generates an entire carousel (N slides) in a single call, reusing one browser. Numbers {{slide}}/{{slidetotal}} automatically when the slide doesn\'t provide them. Returns the list of PNG paths, in order.',
  {
    brandId: z.string().describe('brand id (see list_brands)'),
    templateId: z.string().describe('slide template; default: carrossel-slide').optional(),
    slides: z.array(z.record(z.string(), z.string())).describe('one content object per slide (titulo, kicker, corpo, cta...). slide/slidetotal are filled in automatically if absent.'),
    outDir: z.string().describe('output folder (optional; default: out/)').optional(),
    prefix: z.string().describe('file prefix (optional; default: <brand>-carrossel)').optional(),
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
log('canva-killer MCP server running (stdio) — tools: list_brands, list_templates, render, render_carousel');
