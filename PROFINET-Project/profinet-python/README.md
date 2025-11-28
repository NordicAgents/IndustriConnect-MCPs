# profinet-python

Python MCP server for Siemens PROFINET networks. Built with `uv`, `scapy`, `lxml`, and `mcp[cli]`, it exposes the `profinet-mcp` CLI for AI agents and MCP clients.

## Quick Start

```bash
uv sync
PROFINET_INTERFACE=eth0 uv run profinet-mcp
```

Environment variables (or `.env`) configure controller IP, interface, retry settings, write/config enablement, and the optional device map path.

## Structure

```
profinet-python/
├── pyproject.toml
├── .python-version
└── src/profinet_mcp
    ├── __init__.py
    ├── cli.py
    ├── server.py
    ├── tools.py
    ├── pn_client.py
    └── gsd_parser.py
```

`pn_client.py` wraps low-level discovery/I/O helpers (currently scaffolded with placeholders and retries), `gsd_parser.py` covers GSDML parsing and caching, and `tools.py` registers MCP tools for discovery, device map aliases, and diagnostics. Extend these modules to implement DCP packets, cyclic I/O, module records, and the rest of the roadmap outlined in `docs/roadmap/PROFINET_PLAN.md`.
