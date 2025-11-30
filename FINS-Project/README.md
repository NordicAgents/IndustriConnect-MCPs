# Omron FINS Protocol MCP Server

A Model Context Protocol (MCP) server for the Omron FINS Protocol, enabling AI agents to communicate with Omron PLCs (CJ, CS, CP, NJ, NX series).

## Components

- **fins-python**: Python implementation of the MCP server.
- **fins-npm**: Node.js/TypeScript implementation of the MCP server.
- **fins-mock-plc**: A mock Omron PLC for testing and development.

## Quick Start

### Python Server

```bash
cd fins-python
uv run fins-mcp
```

### NPM Server

```bash
cd fins-npm
npm install
npm start
```

### Mock PLC

```bash
cd fins-mock-plc
uv run fins_mock_plc.py
```

## Documentation

See the `docs/roadmap/FINS_PLAN.md` for detailed architecture and implementation plan.
