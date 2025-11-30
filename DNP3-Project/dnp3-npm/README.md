# dnp3-npm

TypeScript/Node implementation of the DNP3 MCP server. It mirrors the Python runtime but targets Node 18+ with planned OpenDNP3 bindings and `serialport` for serial channels. The CLI entry point is `dnp3-mcp`.

## Usage

```bash
npm install
npm run build
DNP3_CONNECTION_TYPE=tcp DNP3_HOST=127.0.0.1 DNP3_PORT=20000 node build/index.js
```

During development:

```bash
npm run dev
```

Configure host/port or serial settings plus poll intervals, write/security toggles, and point-map path via environment variables in `docs/roadmap/DNP3_PLAN.md`.

## Status

`src/index.ts` includes the MCP server wiring, master wrapper scaffold, point-map loader, and core tools for reading binary/analog points, issuing binary controls, polling classes, alias access, and ping diagnostics. Actual DNP3 protocol handling is stubbed until OpenDNP3 bindings are integrated.
