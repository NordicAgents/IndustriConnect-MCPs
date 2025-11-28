# PROFINET MCP Project

Reference implementation of Model Context Protocol servers for Siemens/PI PROFINET networks. The repository mirrors the MODBUS and S7 projects with parallel Python and TypeScript runtimes plus a mock IO device so AI agents can discover devices, inspect modules, and exchange I/O data safely.

## Layout

```
PROFINET-Project/
├── README.md
├── .gitignore
├── profinet-python/        # Python MCP server (uv managed)
├── profinet-npm/           # TypeScript/Node MCP server
└── profinet-mock-server/   # Mock PROFINET IO device
```

Each runtime exposes the same tool names and the `{ success, data, error, meta }` response format described in `docs/roadmap/PROFINET_PLAN.md`.

## Planned Highlights

- DCP discovery and configuration (device name/IP, flashing identification)
- I/O data access per slot/subslot, cyclic read/write helpers
- Module/diagnostic/record tools backed by GSDML parsing
- Device map aliases with engineering scaling metadata
- Network scan/topology probes and communication tests
- Mock IO device with configurable modules for local development

### Components

- **profinet-python** – uv-based Python server using Scapy/pyshark-style packets for DCP + XML parsing for GSD. Ships the `profinet-mcp` CLI.
- **profinet-npm** – Node 18+ server using raw sockets/pcap bindings and `fast-xml-parser`, exported as `profinet-mcp`.
- **profinet-mock-server** – Python script that simulates a PROFINET IO device, responding to JSON/DCP-like requests for integration testing.

Current contents provide scaffolding (package metadata, entrypoints, client wrappers, tool registration) so feature work can proceed per the roadmap.
