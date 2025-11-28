# ethercat-python

Python MCP server for EtherCAT using [PySOEM](https://pysoem.readthedocs.io/). It exposes the `ethercat-mcp` CLI so MCP-compatible clients can scan slaves, read/write PDOs and SDOs, and inspect diagnostics, all while returning structured `{ success, data, error, meta }` payloads.

## Requirements

- Python 3.11+
- [uv](https://github.com/astral-sh/uv)
- Network interface with EtherCAT access (root/cap_net_raw permissions)
- PySOEM prerequisites (SOEM compiled, lib installed if needed)

## Quick Start

```bash
uv sync
sudo PROFINET_INTERFACE=eth0 uv run ethercat-mcp
```

Set environment variables (or a `.env` file) for `ETHERCAT_INTERFACE`, cycle time, write/state toggles, `SLAVE_MAP_FILE`, `ETHERCAT_ESI_PATH`, etc. See `docs/roadmap/ETHERCAT_PLAN.md` for the full list.

## Layout

```
ethercat-python/
├── README.md
├── pyproject.toml
├── .python-version
└── src/ethercat_mcp
    ├── __init__.py
    ├── cli.py
    ├── server.py
    ├── tools.py
    ├── ec_master.py
    └── esi_parser.py
```

The current implementation wires a master wrapper (`ec_master.py`), ESI parser, device/slave map logic, and core MCP tools (scan network, slave info, PDO/SDO read/write stubs, alias helpers, ping). Extend these modules to fulfill the rest of the roadmap features (distributed clocks, advanced diagnostics, FoE, etc.).
