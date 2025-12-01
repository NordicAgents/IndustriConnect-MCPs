# MCP UI Client (Node/TypeScript)

Local MCP client that reads `mcp.json`, starts your MCP servers (Node/TS or Python), and lets you chat with them through an LLM.

## Quickstart

1) Copy `.env.example` → `.env` and set your LLM credentials.  
2) Edit `mcp.json` to point at your local MCP servers (example includes `mcp-manager-ui` placeholder).  
3) Install deps:

```bash
npm install
```

4) Run an interactive chat:

```bash
npm run dev -- chat
```

Other commands:
- `npm run dev -- list-tools`
- `npm run dev -- call <server> <tool> '{"arg":"value"}'`

## Notes

- Process-based MCP servers are supported first (command/args/cwd/env).  
- URL-only MCP entries (e.g., SSE endpoints) are parsed but skipped in v1.  
- Tool names exposed to the LLM are namespaced as `server::tool`.  
- Update `mcp.json` with real start commands for each server. The `mcp-manager-ui` entry is a placeholder until you wire its server start command.
- If you see `Cannot write MCP request` or similar, the server process likely exited immediately (missing command/script). Confirm the command runs standalone before using it in `mcp.json`.
