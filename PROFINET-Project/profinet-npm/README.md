# profinet-npm

TypeScript/Node flavor of the PROFINET MCP server. It mirrors the Python tool set but targets Node 18+ with raw socket hooks (to be implemented) and `fast-xml-parser` for GSD files. The CLI entry point is `profinet-mcp`.

## Getting Started

```bash
npm install
npm run build
PROFINET_INTERFACE=eth0 node build/index.js
```

During development:

```bash
npm run dev
```

Configure network interface, controller IP, retry settings, and device map/GSD paths via environment variables documented in `docs/roadmap/PROFINET_PLAN.md`.

## Status

`src/index.ts` provides the skeleton MCP server, controller wrapper, device map loader, and GSD parser integration. Each tool currently returns placeholder data until the low-level PROFINET stack is implemented. Extend `src/index.ts` and `src/gsdParser.ts` to add DCP discovery, cyclic I/O, module records, diagnostics, and parity with the Python runtime.
