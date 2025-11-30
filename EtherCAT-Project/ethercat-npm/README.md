# ethercat-npm

TypeScript/Node implementation of the EtherCAT MCP server. It mirrors the Python tool set but targets Node 18+ with planned SOEM bindings and `fast-xml-parser` for ESI parsing. The CLI entrypoint is `ethercat-mcp`.

## Usage

```bash
npm install
npm run build
sudo ETHERCAT_INTERFACE=eth0 node build/index.js
```

During development you can run:

```bash
npm run dev
```

Environment variables (or `.env`) configure interface, cycle time, write/state toggles, `SLAVE_MAP_FILE`, and `ETHERCAT_ESI_PATH`. See `docs/roadmap/ETHERCAT_PLAN.md` for details.

## Status

`src/index.ts` currently includes the MCP server wiring, a placeholder master wrapper, ESI parser integration, slave map helpers, and tool handlers for scan/read/write/ping flows. Low-level EtherCAT operations are stubbed until Node bindings (SOEM or equivalent) are added.
