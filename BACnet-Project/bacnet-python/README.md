# bacnet-python

Python MCP server for BACnet/IP. Built with `uv`, `BAC0`, and `mcp[cli]`, it exposes the `bacnet-mcp` CLI so AI agents and MCP-compatible clients can discover devices, read/write object properties, subscribe to COVs, and inspect alarms/trends.

## Requirements

- Python 3.11+
- [uv](https://github.com/astral-sh/uv)
- BAC0 dependencies (BACnet/IP stack, libsqlite, etc.)

## Quick Start

```bash
uv sync
BACNET_INTERFACE=0.0.0.0 BACNET_PORT=47808 uv run bacnet-mcp
```

Environment variables (or `.env`) configure interface, device instance, timeouts, write/COV toggles, and the optional object map path. See `docs/roadmap/BACNET_PLAN.md` for full details.

## Layout

```
bacnet-python/
├── README.md
├── pyproject.toml
├── .python-version
└── src/bacnet_mcp
    ├── __init__.py
    ├── cli.py
    ├── server.py
    ├── tools.py
    └── bacnet_client.py
```

This scaffold wires a BACnet client wrapper (using BAC0), FastMCP server, object-map loader, and tools for device/object discovery, property reads/writes, COV subscriptions, alias access, and ping diagnostics. Extend these modules to implement advanced services (alarms, schedules, trends, files) per the roadmap.
