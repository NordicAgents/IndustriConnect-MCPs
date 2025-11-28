# s7comm-npm

TypeScript/Node implementation of the Siemens S7 MCP server. It mirrors the Python tool set but targets Node 18+ with `@modelcontextprotocol/sdk`, `node-snap7`, and `nodes7`. The CLI entry point is `s7comm-mcp`.

## Getting Started

```bash
npm install
npm run build
S7_HOST=127.0.0.1 S7_RACK=0 S7_SLOT=2 node build/index.js
```

During development you can use:

```bash
npm run dev
```

## Environment Variables

```
S7_HOST=192.168.0.1
S7_PORT=102
S7_RACK=0
S7_SLOT=2
S7_CONNECTION_TYPE=PG
S7_TIMEOUT=5
S7_MAX_RETRIES=3
S7_RETRY_BACKOFF_BASE=0.5
S7_WRITES_ENABLED=true
S7_SYSTEM_CMDS_ENABLED=false
TAG_MAP_FILE=./tags.json
```

## Status

The current code base provides the server skeleton, environment wiring, and initial tool handlers (`read_db`, `write_db`, I/O helpers, tag map, diagnostics). Each handler returns the canonical `{ success, data, error, meta }` envelope; extend `src/index.ts` to flesh out the remaining roadmap items (typed reads, SZL, batch operations, parity with Python). See `docs/roadmap/S7COMM_PLAN.md` for the full checklist.
