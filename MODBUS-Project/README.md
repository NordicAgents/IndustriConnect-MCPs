# Modbus MCP Project

A Model Context Protocol (MCP) server for Modbus that lets AI agents and MCP‑compatible apps read and write Modbus devices over TCP, UDP, or Serial (RTU). This repo contains:

- modbus-python: Full‑featured Python MCP server (uv managed)
- modbus-npm: NPX‑friendly MCP server built with TypeScript/Node.js
- modbus-mock-server: Lightweight Modbus TCP mock device for local testing

Both servers expose the same tool names and semantics so you can pick the runtime that fits your stack.

## Features

- Core Modbus tools: coils, discrete inputs, holding/input registers; masked write; device info
- Typed decode/encode: int16/uint16/int32/uint32/float32/int64/uint64/float64 with byteorder/wordorder, scale, offset
- Reliability: retries with backoff, per‑tool timeouts, automatic chunking
- Tag map: optional JSON map for named points with `list_tags`, `read_tag`, `write_tag`
- Health: `ping` reports status and configuration
- Structured results: uniform `{ success, data, error, meta }` responses

## Repo Layout

- modbus-python/ — Python MCP server (`modbus-mcp` entrypoint)
- modbus-npm/ — NPX/Node MCP server (`modbus-mcp` bin)
- modbus-mock-server/ — Local Modbus TCP simulator (default port 1502)

## Quick Start (Local)

1) Start the mock Modbus device

```bash
cd modbus-mock-server
uv sync
uv run modbus-mock-server  # listens on 0.0.0.0:1502
```

2) Run an MCP server (choose Python or NPX)

Python (uv):
```bash
cd ../modbus-python
export MODBUS_TYPE=tcp
export MODBUS_HOST=127.0.0.1
export MODBUS_PORT=1502    # match mock server
export MODBUS_DEFAULT_SLAVE_ID=1
uv sync
uv run modbus-mcp
```

Node/NPX (local build):
```bash
cd ../modbus-npm
npm install
npm run build
MODBUS_TYPE=tcp MODBUS_HOST=127.0.0.1 MODBUS_PORT=1502 MODBUS_DEFAULT_SLAVE_ID=1 \
node build/index.js
```

Both servers communicate over stdio as per MCP.

## MCP Client Examples

### Claude Desktop

Python server (uv):
```json
{
  "mcpServers": {
    "Modbus MCP (Python)": {
      "command": "uv",
      "args": ["--directory", "/absolute/path/to/modbus-python", "run", "modbus-mcp"],
      "env": { "MODBUS_TYPE": "tcp", "MODBUS_HOST": "127.0.0.1", "MODBUS_PORT": "1502", "MODBUS_DEFAULT_SLAVE_ID": "1" }
    }
  }
}
```

NPX server (Node):
```json
{
  "mcpServers": {
    "Modbus MCP (NPX)": {
      "command": "modbus-mcp",
      "env": { "MODBUS_TYPE": "tcp", "MODBUS_HOST": "127.0.0.1", "MODBUS_PORT": "1502", "MODBUS_DEFAULT_SLAVE_ID": "1" }
    }
  }
}
```
Tip: For local builds, use "command": "node" and set "args" to the absolute path of `modbus-npm/build/index.js`.

### MCP Inspector / CLI

You can also use any MCP runner that connects to a stdio server. The tools are listed via MCP’s `list_tools` and invoked with `call_tool`.

## Tools and Example Calls

All tools return `{ success, data, error, meta }`.

- Read a holding register
```json
{ "tool": "read_register", "parameters": { "address": 0, "slave_id": 1 } }
```

- Write a holding register
```json
{ "tool": "write_register", "parameters": { "address": 5, "value": 42, "slave_id": 1 } }
```

- Read coils (chunked automatically)
```json
{ "tool": "read_coils", "parameters": { "address": 0, "count": 8, "slave_id": 1 } }
```

- Write multiple coils
```json
{ "tool": "write_coils_bulk", "parameters": { "address": 0, "values": [true, false, true], "slave_id": 1 } }
```

- Read input registers
```json
{ "tool": "read_input_registers", "parameters": { "address": 0, "count": 4, "slave_id": 1 } }
```

- Read discrete inputs
```json
{ "tool": "read_discrete_inputs", "parameters": { "address": 0, "count": 8, "slave_id": 1 } }
```

- Read multiple holding registers
```json
{ "tool": "read_multiple_holding_registers", "parameters": { "address": 0, "count": 3, "slave_id": 1 } }
```

- Mask write register
```json
{ "tool": "mask_write_register", "parameters": { "address": 100, "and_mask": 65535, "or_mask": 3, "slave_id": 1 } }
```

- Device identification (MEI 0x2B/0x0E)
```json
{ "tool": "read_device_information", "parameters": { "slave_id": 1, "read_code": 3 } }
```

- Typed read (endianness + scaling)
```json
{ "tool": "read_holding_typed", "parameters": { "address": 200, "dtype": "float32", "count": 2, "byteorder": "little", "wordorder": "big", "scale": 1.0, "offset": 0.0, "slave_id": 1 } }
```

- Write multiple holding registers
```json
{ "tool": "write_registers", "parameters": { "address": 50, "values": [1, 2, 3], "slave_id": 1 } }
```

- Health
```json
{ "tool": "ping", "parameters": {} }
```

## Tag Map (Optional)

Point `REGISTER_MAP_FILE` to a JSON file to define named points. Example:

```json
{
  "PumpSpeed": { "table": "holding", "address": 100, "dtype": "float32", "count": 1, "byteorder": "big", "wordorder": "big", "slave_id": 1 },
  "ValveOpen": { "table": "coil", "address": 5, "slave_id": 1 },
  "Alarm": { "table": "discrete", "address": 10, "count": 4, "slave_id": 1 }
}
```

- List tags:
```json
{ "tool": "list_tags", "parameters": {} }
```
- Read a tag:
```json
{ "tool": "read_tag", "parameters": { "name": "PumpSpeed" } }
```
- Write a tag (coils use booleans; holding uses values encoded by dtype):
```json
{ "tool": "write_tag", "parameters": { "name": "ValveOpen", "value": true } }
```

## Environment Variables

- MODBUS_TYPE: tcp | udp | serial (default: tcp)
- MODBUS_HOST: host for TCP/UDP (default: 127.0.0.1)
- MODBUS_PORT: port for TCP/UDP (default: 502; mock uses 1502)
- MODBUS_DEFAULT_SLAVE_ID: default unit id (default: 1)
- MODBUS_SERIAL_PORT: serial device path (default: /dev/ttyUSB0)
- MODBUS_BAUDRATE: serial baud (default: 9600)
- MODBUS_PARITY: N | E | O (default: N)
- MODBUS_STOPBITS: stop bits (default: 1)
- MODBUS_BYTESIZE: data bits (default: 8)
- MODBUS_TIMEOUT: seconds per request (default: 1)
- MODBUS_MAX_RETRIES: retry attempts (default: 2)
- MODBUS_RETRY_BACKOFF_BASE: backoff seconds (default: 0.2)
- MODBUS_TOOL_TIMEOUT: per‑tool timeout (seconds, optional)
- MODBUS_WRITES_ENABLED: true/false to allow writes (default: true)
- REGISTER_MAP_FILE: path to tag‑map JSON (optional)

## Testing With The Mock Server

- Open modbus-mock-server/README.md for register map and controls.
- Common smoke tests against the mock:
  - `read_register(address=0)` → Valve Position
  - `write_register(address=1, value=50)` → Heater Power = 50%
  - `read_input_registers(address=0, count=4)` → Temperature/Pressure/Flow/Tank Level
  - `write_register(address=6, value=1)` → Start command

## Development

- Python
  - Requires Python 3.10+ and uv
  - From `modbus-python`: `uv sync`, then `uv run modbus-mcp`
- Node/TypeScript
  - From `modbus-npm`: `npm install`, `npm run build`, then `node build/index.js`

## Troubleshooting

- Permission denied on port 502 → use non‑root port 1502
- No response → verify firewall and MODBUS_HOST/MODBUS_PORT; ensure server connects to mock or device
- Writes rejected → set `MODBUS_WRITES_ENABLED=true`
- Serial issues → confirm port name, baud, parity, stop bits, and device permissions

## License

See individual package folders for license details.

