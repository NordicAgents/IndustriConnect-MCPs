# EtherCAT MCP Project

Model Context Protocol tooling for Beckhoff EtherCAT networks. The repository mirrors the MODBUS/S7 stacks with a Python MCP runtime plus a mock slave so AI agents can discover slaves, read/write PDOs/SDOs, and inspect diagnostics safely.

## Layout

```
EtherCAT-Project/
├── README.md
├── .gitignore
├── ethercat-python/        # Python MCP server (uv, PySOEM)
└── ethercat-mock-slave/    # Mock EtherCAT slave for tests
```

## Highlights

- Network management: scan, slave info, state control, working counter inspection
- PDO/SDO tooling with CoE helpers, distributed clocks toggles, and alias-based slave maps
- ESI file parsing utilities to surface PDO mappings and configuration guardrails
- Mock slave that simulates state machine + PDO buffers for local smoke tests

See `docs/roadmap/ETHERCAT_PLAN.md` for the complete implementation plan. This repo currently contains scaffolding (project metadata, entrypoints, client wrappers, tool registration, and docs) so feature work can focus on the remaining TODOs.
