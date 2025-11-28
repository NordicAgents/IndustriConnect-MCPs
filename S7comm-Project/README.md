# S7comm MCP Project

A Model Context Protocol (MCP) stack for interacting with Siemens S7 PLCs (S7-300/400/1200/1500) over the S7comm protocol. The repository provides parity between Python and TypeScript implementations plus a mock PLC so AI agents and MCP-compatible clients can read and write Siemens data blocks, I/O, and system information.

## Repository Layout

```
S7comm-Project/
├── README.md
├── .gitignore
├── s7comm-python/        # Python MCP server (uv managed)
├── s7comm-npm/           # Node/TypeScript MCP server
└── s7comm-mock-server/   # Mock Siemens PLC for local testing
```

Each runtime exposes the same tool names, schemas, and `{ success, data, error, meta }` response envelope so you can pick the best environment for your deployment.

## Features (Planned)

- Comprehensive S7 data access: DB, inputs, outputs, markers, SZL, CPU state
- Typed read/write helpers (BYTE, WORD, DWORD, INT, DINT, REAL, STRING, BOOL)
- Tag map system with `list_tags`, `read_tag`, `write_tag`
- Health tools: `ping`, `get_connection_status`
- Uniform configuration via environment variables, `.env`, or CLI flags
- Mock PLC for confident local testing before touching a real device

## Components

- **s7comm-python**: Python 3.10+ server built with `mcp[cli]`, `python-snap7`, and `uv`. Provides the `s7comm-mcp` CLI entry point.
- **s7comm-npm**: TypeScript 5.6+ server built on `@modelcontextprotocol/sdk` and `nodes7`. Publishes an NPX-friendly bin.
- **s7comm-mock-server**: uv-managed project that simulates a Siemens PLC with configurable data blocks, I/O, and diagnostics.

## Status

The repo currently contains scaffolding for all three components (see docs/roadmap/S7COMM_PLAN.md for the full implementation plan). Each directory has placeholders for code, tests, and documentation so contributions can focus on the remaining TODOs.

## References

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Snap7 / python-snap7](http://snap7.sourceforge.net/)
- [nodes7 on npm](https://www.npmjs.com/package/nodes7)
- [Siemens S7 S7comm Overview](https://wiki.wireshark.org/S7comm)
