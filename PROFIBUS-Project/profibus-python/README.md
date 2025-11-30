# profibus-python

Python MCP server for PROFIBUS DP/PA networks. Built with `uv`, `pyserial`, and `mcp[cli]`, it exposes the `profibus-mcp` CLI for AI agents and MCP-compatible clients to scan the bus, exchange data, and query diagnostics.

## Requirements

- Python 3.11+
- [uv](https://github.com/astral-sh/uv)
- Serial/USB PROFIBUS adapter accessible from the host (permissions for `/dev/tty*`)

## Quick Start

```bash
uv sync
PROFIBUS_PORT=/dev/ttyUSB0 PROFIBUS_BAUDRATE=500000 uv run profibus-mcp
```

Set environment variables (or `.env`) for master address, retries, GSD path, write/config toggles, and optional slave map path. See `docs/roadmap/PROFIBUS_PLAN.md` for the full list.

## Layout

```
profibus-python/
├── README.md
├── pyproject.toml
├── .python-version
└── src/profibus_mcp
    ├── __init__.py
    ├── cli.py
    ├── server.py
    ├── tools.py
    ├── pb_master.py
    └── gsd_parser.py
```

This scaffold wires a serial master wrapper (`pb_master.py`), GSD/GSDML parser, slave map loader, and MCP tools for bus scanning, I/O reads/writes, alias helpers, and health reporting. Flesh out the protocol-specific operations per the roadmap.
