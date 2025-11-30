# ethernetip-npm

TypeScript/Node implementation of the EtherNet/IP MCP server. It provides the same tool surface as the Python runtime but targets Node 18+ with `ethernet-ip` and `@modelcontextprotocol/sdk`. The NPX-friendly entry point is `ethernetip-mcp`.

## Usage

```bash
npm install
npm run build
ENIP_HOST=192.168.1.10 ENIP_SLOT=0 node build/index.js
```

During development you can run:

```bash
npm run dev
```

Configure host, slot, path, and safety toggles via environment variables:

```
ENIP_HOST=192.168.1.10
ENIP_PORT=44818
ENIP_SLOT=0
ENIP_TIMEOUT=10
ENIP_WRITES_ENABLED=true
ENIP_SYSTEM_CMDS_ENABLED=false
TAG_MAP_FILE=./tags.json
```

## Status

`src/index.ts` already includes the controller wrapper, tag map loader, and MCP tool handlers for tag operations, arrays, tag aliases, and diagnostics. Extend it to handle UDT discovery, module information, and other roadmap items. Consult `docs/roadmap/ETHERNETIP_PLAN.md` for the remaining features.
