# BACnet MCP Project

Model Context Protocol servers for BACnet/IP building automation systems. The repository mirrors the MODBUS/DNP3 stacks with Python and TypeScript runtimes plus a mock BACnet device so AI agents can discover devices, read/write object properties, manage COVs, and inspect alarms safely.

## Layout

```
BACnet-Project/
├── README.md
├── .gitignore
├── bacnet-python/        # Python MCP server (uv, BAC0/bacpypes)
├── bacnet-npm/           # TypeScript/Node MCP server
└── bacnet-mock-device/   # Mock BACnet device
```

## Highlights

- Device/object discovery, property reads/writes, COV subscriptions, schedules, trends, and alarms
- Object-map aliasing for friendly access, plus diagnostics and Who-Is/I-Am helpers
- Mock device for local testing

See `docs/roadmap/BACNET_PLAN.md` for the detailed roadmap. The current scaffolding (metadata, entrypoints, client wrappers, tool registration, docs) will let us focus next on BACnet protocol bindings.
