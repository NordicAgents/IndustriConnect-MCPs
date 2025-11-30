# Omron FINS Protocol MCP Server (Python)

A Python implementation of the Model Context Protocol (MCP) server for Omron FINS Protocol.

## Installation

```bash
uv sync
```

## Usage

```bash
uv run fins-mcp
```

## Configuration

Create a `.env` file with the following variables:

```bash
FINS_HOST=192.168.1.10
FINS_PORT=9600
FINS_PROTOCOL=tcp
```
