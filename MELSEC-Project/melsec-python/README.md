# melsec-python

Python MCP server for Mitsubishi MELSEC MC protocol (3E/4E frames). Built with `uv`, `pymcprotocol`, and `mcp[cli]`, it exposes the `melsec-mcp` CLI so MCP-compatible clients can read/write device memory, run batch operations, and issue remote controls.

## Requirements

- Python 3.11+
- [uv](https://github.com/astral-sh/uv)
- `pymcprotocol` (requires TCP connectivity to the PLC)

## Quick Start

```bash
uv sync
MC_HOST=192.168.1.10 MC_PORT=5007 uv run melsec-mcp
```

Configure protocol type (3E/4E), frame (binary/ascii), module numbers, and device-map path via environment variables described in `docs/roadmap/MELSEC_PLAN.md`.

## Layout

```
melsec-python/
├── README.md
├── pyproject.toml
├── .python-version
└── src/melsec_mcp
    ├── __init__.py
    ├── cli.py
    ├── server.py
    ├── tools.py
    └── mc_client.py
```

Current scaffolding includes the MC client wrapper (using pymcprotocol), FastMCP server wiring, device-map loader, and tools for basic device reads/writes, alias access, and ping diagnostics. Extend these modules to implement the remaining roadmap features (batch operations, remote run/stop, monitoring, file access, data type conversions).
