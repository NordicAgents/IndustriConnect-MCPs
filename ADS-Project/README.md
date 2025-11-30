# Beckhoff ADS Protocol MCP Server

A Model Context Protocol (MCP) server for the Beckhoff ADS Protocol, enabling AI agents to communicate with TwinCAT systems.

## Components

- **ads-python**: Python implementation of the MCP server.
- **ads-npm**: Node.js/TypeScript implementation of the MCP server.
- **ads-mock-plc**: A mock TwinCAT PLC for testing and development.

## Quick Start

### Python Server

```bash
cd ads-python
uv run ads-mcp
```

### NPM Server

```bash
cd ads-npm
npm install
npm start
```

### Mock PLC

```bash
cd ads-mock-plc
uv run ads_mock_plc.py
```

## Documentation

See the `docs/roadmap/ADS_PLAN.md` for detailed architecture and implementation plan.
