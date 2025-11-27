Modbus MCP NPX Server

Overview
- NPX-friendly Model Context Protocol server exposing Modbus tools over stdio.
- Supports Modbus TCP, UDP, and Serial (RTU) via `modbus-serial`.
- Mirrors the Python Modbus MCP: core read/write, typed decode/encode, tag map, retries, chunking, and health.

Install/Run
- Run via npx (when published) or clone and build locally.

Local build
- From this folder:
  - `npm install`
  - `npm run build`
  - `node build/index.js`

Claude Desktop config (example)
{
  "mcpServers": {
    "Modbus MCP (NPX)": {
      "command": "modbus-mcp",
      "env": { "MODBUS_TYPE": "tcp", "MODBUS_HOST": "127.0.0.1", "MODBUS_PORT": "502", "MODBUS_DEFAULT_SLAVE_ID": "1" }
    }
  }
}

Environment
- `MODBUS_TYPE`: `tcp` | `udp` | `serial` (default: `tcp`)
- `MODBUS_HOST`: host for TCP/UDP (default: `127.0.0.1`)
- `MODBUS_PORT`: port for TCP/UDP (default: `502`)
- `MODBUS_DEFAULT_SLAVE_ID`: default unit id (default: `1`)
- `MODBUS_SERIAL_PORT`: serial device path (default: `/dev/ttyUSB0`)
- `MODBUS_BAUDRATE`: serial baud (default: `9600`)
- `MODBUS_PARITY`: `N` | `E` | `O` (default: `N`)
- `MODBUS_STOPBITS`: stop bits (default: `1`)
- `MODBUS_BYTESIZE`: data bits (default: `8`)
- `MODBUS_TIMEOUT`: seconds per request (default: `1`)
- `MODBUS_MAX_RETRIES`: retry attempts (default: `2`)
- `MODBUS_RETRY_BACKOFF_BASE`: backoff seconds (default: `0.2`)
- `MODBUS_TOOL_TIMEOUT`: per-tool timeout (seconds, optional)
- `MODBUS_WRITES_ENABLED`: `true`/`false` (default: `true`)
- `REGISTER_MAP_FILE`: path to tag-map JSON (optional)

Tools
- `read_register`: address, slave_id?
- `write_register`: address, value, slave_id?
- `read_coils`: address, count, slave_id?
- `write_coil`: address, value, slave_id?
- `read_input_registers`: address, count, slave_id?
- `read_multiple_holding_registers`: address, count, slave_id?
- `read_discrete_inputs`: address, count, slave_id?
- `write_registers`: address, values[], slave_id?
- `write_coils_bulk`: address, values[], slave_id?
- `mask_write_register`: address, and_mask, or_mask, slave_id?
- `read_device_information`: slave_id?, read_code?, object_id?
- `read_holding_typed`: address, dtype, count?, byteorder?, wordorder?, scale?, offset?, slave_id?
- `read_input_typed`: address, dtype, count?, byteorder?, wordorder?, scale?, offset?, slave_id?
- `list_tags`
- `read_tag`: name
- `write_tag`: name, value
- `ping`

Result shape
- Every tool returns JSON content: `{ success, data, error, meta }`.

Tag map (optional)
- Example file referenced by `REGISTER_MAP_FILE`:
{
  "PumpSpeed": { "table": "holding", "address": 100, "dtype": "float32", "count": 1, "byteorder": "big", "wordorder": "big", "slave_id": 1 },
  "ValveOpen": { "table": "coil", "address": 5, "slave_id": 1 },
  "Alarm": { "table": "discrete", "address": 10, "count": 4, "slave_id": 1 }
}

Notes
- Uses `modbus-serial` which supports TCP, UDP, and Serial (RTU). Function coverage: FC1, FC2, FC3, FC4, FC5, FC6, FC15, FC16, FC22, and MEI 43/14.
- Reads are chunked to protocol limits: coils/discretes=2000, registers=125.
- Typed decode/encode supports int16/uint16/int32/uint32/float32/int64/uint64/float64 with byteorder and wordorder semantics.
