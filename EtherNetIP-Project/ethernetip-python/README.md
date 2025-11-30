# ethernetip-python

Python MCP server for Rockwell/Allen-Bradley EtherNet/IP controllers. Built with `pycomm3`, `mcp[cli]`, and `uv`, it exposes the `ethernetip-mcp` entry point for AI agents and MCP-compatible clients.

## Prerequisites

- Python 3.11+
- [uv](https://github.com/astral-sh/uv)
- Network access to a controller or the included mock server

## Quick Start

```bash
uv sync
ENIP_HOST=192.168.1.10 ENIP_SLOT=0 uv run ethernetip-mcp
```

Create a `.env` file or set environment variables to configure host, slot, timeouts, write permissions, and tag map path.

## Layout

```
ethernetip-python/
├── README.md
├── pyproject.toml
├── .python-version
└── src/ethernetip_mcp
    ├── __init__.py
    ├── cli.py
    ├── server.py
    ├── tools.py
    └── eip_client.py
```

## Status

The scaffolding in `server.py`, `eip_client.py`, and `tools.py` implements connection management, retries, structured responses, and the initial tool surface (`read_tag`, `write_tag`, array/string helpers, discovery stubs, tag map, and health checks). Extend these modules to cover the remaining roadmap features such as UDT operations, module info, and batch tooling. Refer to `docs/roadmap/ETHERNETIP_PLAN.md` for the complete plan.
