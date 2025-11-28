# profibus-npm

TypeScript/Node implementation of the PROFIBUS MCP server. It mirrors the Python runtime but targets Node 18+ with `serialport` and `fast-xml-parser`. The CLI entrypoint is `profibus-mcp`.

## Usage

```bash
npm install
npm run build
PROFIBUS_PORT=/dev/ttyUSB0 PROFIBUS_BAUDRATE=500000 node build/index.js
```

During development:

```bash
npm run dev
```

Configure port, baud rate, master address, retry settings, and GSD/slave map paths via environment variables documented in `docs/roadmap/PROFIBUS_PLAN.md`.

## Status

`src/index.ts` wires a serial master scaffold, GSD parser, slave map handling, and MCP tools for bus scans, I/O reads/writes, alias helpers, and diagnostics. Low-level PROFIBUS telegram handling is still mocked until a real implementation is added.
