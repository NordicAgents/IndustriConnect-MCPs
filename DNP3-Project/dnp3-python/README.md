# dnp3-python

Python MCP server for DNP3. Built with `uv`, `pydnp3`, `pyserial`, and `mcp[cli]`, it exposes the `dnp3-mcp` CLI so MCP-compatible clients can poll points, issue controls, and inspect DNP3 diagnostics.

## Requirements

- Python 3.11+
- [uv](https://github.com/astral-sh/uv)
- DNP3 network access (TCP or serial) and the native pydnp3 dependencies

## Quick Start

```bash
uv sync
DNP3_CONNECTION_TYPE=tcp DNP3_HOST=127.0.0.1 DNP3_PORT=20000 uv run dnp3-mcp
```

Set environment variables (or a `.env` file) for master/outstation addresses, poll intervals, write/security toggles, and the optional point map file. See `docs/roadmap/DNP3_PLAN.md` for the full matrix.

## Layout

```
dnp3-python/
├── README.md
├── pyproject.toml
├── .python-version
└── src/dnp3_mcp
    ├── __init__.py
    ├── cli.py
    ├── server.py
    ├── tools.py
    └── dnp3_master.py
```

This scaffold wires a master wrapper (`dnp3_master.py`), FastMCP server, point-map loader, and tools for reading binary/analog points, writing outputs, polling classes, alias-based access, and ping diagnostics. Fill in the protocol-specific logic (OpenDNP3 channels, event handling, time sync, file transfer, etc.) per the roadmap.
