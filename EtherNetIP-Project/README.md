# EtherNetIP MCP Project

MCP-based tooling for Rockwell/Allen-Bradley PLCs over EtherNet/IP (ControlLogix, CompactLogix, MicroLogix, etc.). The repository mirrors the MODBUS-Project architecture with Python and TypeScript runtimes plus a mock PLC so AI agents can read/write controller tags safely.

## Repository Layout

```
EtherNetIP-Project/
├── README.md
├── .gitignore
├── ethernetip-python/        # Python MCP server (uv)
├── ethernetip-npm/           # TypeScript/Node MCP server
└── ethernetip-mock-server/   # EtherNet/IP mock PLC
```

Each runtime exposes the same MCP tool names and the canonical `{ success, data, error, meta }` response envelope.

## Planned Capabilities

- Tag operations: scalar, arrays, strings, structures, batch read/write
- Tag discovery: controller/program tag lists, UDT definitions, module info
- PLC info: controller identity, firmware, time, module inventory
- Tag map aliases with scaling metadata
- Health + session control (`ping`, `get_connection_status`, `forward_open`, `forward_close`)
- Mock PLC with deterministic tag database for offline testing

## Components

- **ethernetip-python**: Python 3.11+ server built with `pycomm3`, `mcp[cli]`, and `uv`. Ships the `ethernetip-mcp` entrypoint.
- **ethernetip-npm**: Node 18+ server built with `ethernet-ip` + `@modelcontextprotocol/sdk`, published as `ethernetip-mcp`.
- **ethernetip-mock-server**: Python mock CIP server exposing representative controller/program tags and UDTs.

See `docs/roadmap/ETHERNETIP_PLAN.md` for the detailed implementation phases. This repository currently contains complete scaffolding (project metadata, entrypoints, client wrappers, and placeholder tools) so remaining work can focus on feature completion.
