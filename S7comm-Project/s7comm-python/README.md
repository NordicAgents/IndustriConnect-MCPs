# s7comm-python

Python implementation of the Siemens S7 MCP server. It exposes the same tool set as the TypeScript runtime but is built with `uv`, `mcp[cli]`, and `python-snap7`. The CLI entry point is `s7comm-mcp`.

## Prerequisites

- Python 3.11+
- [uv](https://github.com/astral-sh/uv)
- Snap7 native library (`brew install snap7` on macOS, `apt install libsnap7-dev` on Debian/Ubuntu, download DLLs for Windows)

## Setup

```bash
uv sync                 # installs dependencies into .venv
uv run s7comm-mcp       # starts the MCP server over stdio
```

Configure the connection via environment variables or a `.env` file:

```
S7_HOST=192.168.0.1
S7_PORT=102
S7_RACK=0
S7_SLOT=2
S7_CONNECTION_TYPE=PG
S7_TIMEOUT=5
S7_MAX_RETRIES=3
S7_RETRY_BACKOFF_BASE=0.5
S7_WRITES_ENABLED=true
S7_SYSTEM_CMDS_ENABLED=false
TAG_MAP_FILE=./tags.json
```

## Project Layout

```
s7comm-python/
├── README.md
├── pyproject.toml
├── .python-version
├── .gitignore
└── src/s7comm_mcp
    ├── __init__.py
    ├── cli.py
    ├── server.py
    ├── tools.py
    └── s7_client.py
```

## Status

The scaffolding implements connection management, configuration parsing, retry helpers, and MCP tool registration. Each tool currently focuses on correctness and structured responses; extend the placeholders in `tools.py` as features are implemented (typed reads, SZL, batch ops, etc.). The module docstrings and TODOs call out the main work items per the roadmap in `docs/roadmap/S7COMM_PLAN.md`.
