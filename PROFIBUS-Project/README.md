# PROFIBUS MCP Project

MCP-based tooling for Siemens PROFIBUS DP/PA networks. This repository mirrors the MODBUS/S7/EtherCAT stacks with Python and TypeScript runtimes plus a mock slave so AI agents can scan the bus, exchange cyclic data, and inspect diagnostics safely.

## Layout

```
PROFIBUS-Project/
├── README.md
├── .gitignore
├── profibus-python/        # Python MCP server (uv, pyserial)
├── profibus-npm/           # TypeScript/Node MCP server
└── profibus-mock-slave/    # Mock PROFIBUS slave
```

## Highlights

- Bus scanning, slave info, and address management
- DP data exchange helpers (inputs/outputs, alias-based maps)
- Parameter/diagnostic services and GSD parsing utilities
- Health and master status tools plus a JSON mock slave for local testing

See `docs/roadmap/PROFIBUS_PLAN.md` for the detailed implementation roadmap. Current contents provide scaffolding (project metadata, entrypoints, master wrappers, tool registration, and docs) so feature work can focus on protocol specifics.
