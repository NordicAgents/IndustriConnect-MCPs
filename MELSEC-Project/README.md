# MELSEC MC MCP Project

Model Context Protocol servers for Mitsubishi MELSEC MC protocol (3E/4E frames). The repository mirrors the other industrial stacks with Python and TypeScript runtimes plus a mock PLC so AI agents can read/write device memory, perform batch operations, and issue remote controls safely.

## Layout

```
MELSEC-Project/
├── README.md
├── .gitignore
├── melsec-python/        # Python MCP server (uv, pymcprotocol)
├── melsec-npm/           # TypeScript/Node MCP server
└── melsec-mock-plc/      # Mock MELSEC PLC
```

See `docs/roadmap/MELSEC_PLAN.md` for the detailed roadmap. Current contents provide scaffolding (metadata, entrypoints, client wrappers, tool registration, docs) so further work can focus on the MC protocol specifics.*** End Patch
