# bacnet-npm

TypeScript/Node implementation of the BACnet MCP server. It mirrors the Python runtime but targets Node 18+ with `node-bacnet` for BACnet/IP access. The CLI entry point is `bacnet-mcp`.

## Usage

```bash
npm install
npm run build
BACNET_INTERFACE=0.0.0.0 BACNET_PORT=47808 node build/index.js
```

During development you can run:

```bash
npm run dev
```

Set environment variables for interface, device instance, timeouts, write priority, and object-map path. Refer to `docs/roadmap/BACNET_PLAN.md` for the full matrix.

## Status

`src/index.ts` includes the MCP wiring, client stub, object-map loader, and tools for device discovery, property reads/writes, alias access, and ping diagnostics. Actual BACnet operations are stubbed until node-bacnet bindings are integrated.
