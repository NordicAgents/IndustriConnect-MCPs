# melsec-npm

TypeScript/Node implementation of the MELSEC MC MCP server. It mirrors the Python runtime but targets Node 18+ with a native MC protocol client wrapper. The CLI entry point is `melsec-mcp`.

## Usage

```bash
npm install
npm run build
MC_HOST=192.168.1.10 MC_PORT=5007 node build/index.js
```

During development:

```bash
npm run dev
```

Environment variables configure host/port, protocol type (3E/4E), write toggles, and device-map path. Refer to `docs/roadmap/MELSEC_PLAN.md` for the full list.

## Status

`src/index.ts` contains the MPC wiring, MC client scaffold, device-map loader, and tools for device reads/writes, alias access, and ping diagnostics. Actual MC protocol serialization is stubbed until a concrete implementation is added.
