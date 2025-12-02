# DNP3 MCP Project

Model Context Protocol tooling for the DNP3 SCADA protocol. The repository mirrors the MODBUS/S7/EtherCAT stacks with a Python MCP runtime plus a mock outstation so AI agents can poll points, issue controls, and inspect diagnostics safely.

## Layout

```
DNP3-Project/
├── README.md
├── .gitignore
├── dnp3-python/          # Python MCP server (uv, pydnp3)
└── dnp3-mock-outstation/ # Mock DNP3 outstation
```

## Highlights

- Point reading (binary/analog/counters), control relay operations, class polls, and time sync
- Point-map aliasing for friendly names, security hooks, and link/IIN diagnostics
- Mock outstation with simulated points/events for local development

See `docs/roadmap/DNP3_PLAN.md` for the detailed roadmap. Current scaffolding (package metadata, entrypoints, master wrappers, tool registration, docs) is in place so protocol-specific work can proceed next.
