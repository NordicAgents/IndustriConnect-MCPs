# Modbus Mock Server

A lightweight Modbus TCP mock server to test Modbus clients (e.g., your MCP `modbus-python` project). The layout and docs mirror your OPC UA mock server for consistency.

## Features

- Simulated process values updated every second
- Writable setpoints/controls via holding registers and coils
- Read-only sensors via input registers and discrete inputs
- Simple command registers to start/stop/reset/emergency-stop
- Defaults to TCP port `1502` (non-root)

## Register Map (unit/slave ID: any)

- Coils (RW)
  - `00001` (addr 0): Pump Enabled
  - `00002` (addr 1): Alarm Active (set by simulation; write ignored)

- Discrete Inputs (RO)
  - `10001` (addr 0): Emergency Stop Active
  - `10002` (addr 1): System Running

- Holding Registers (RW)
  - `40001` (addr 0): Valve Position (0-100)
  - `40002` (addr 1): Heater Power (0-100)
  - `40003` (addr 2): Fan Speed (0-100)
  - `40004` (addr 3): Conveyor Speed (0-100)
  - `40005` (addr 4): Production Rate Setpoint (units/hour)
  - `40006` (addr 5): System Mode (0=MANUAL,1=AUTO,2=MAINT)
  - `40007` (addr 6): Command Start (write >0 to start)
  - `40008` (addr 7): Command Stop (write >0 to stop)
  - `40009` (addr 8): Command Emergency Stop (write >0)
  - `40010` (addr 9): Command Reset (write >0)

- Input Registers (RO, scaled where noted)
  - `30001` (addr 0): Temperature x10 (e.g., 253 = 25.3°C)
  - `30002` (addr 1): Pressure (hPa)
  - `30003` (addr 2): Flow Rate (L/min)
  - `30004` (addr 3): Tank Level x10 (0-1000)
  - `30005` (addr 4): Vibration x100
  - `30006` (addr 5): pH Level x100
  - `30007` (addr 6): Humidity x10
  - `30008` (addr 7): Motor Speed (RPM)
  - `30009` (addr 8): Total Production (units, 16-bit, wraps)

Notes: Addresses shown as Modbus-style 1-based with zero-based in parentheses.

## Install

```bash
cd MODBUS-Project/modbus-mock-server
uv sync  # installs deps and entry points
```

## Run

```bash
# default host/port: 0.0.0.0:1502
uv run modbus-mock-server
# or
uv run python -m modbus_local_server
```

Environment overrides:
- `MODBUS_HOST` (default: `0.0.0.0`)
- `MODBUS_PORT` (default: `1502`)
- `UPDATE_INTERVAL` seconds (default: `1.0`)

## Test with modbus-mcp

In `MODBUS-Project/modbus-python`:

```bash
export MODBUS_TYPE=tcp
export MODBUS_HOST=127.0.0.1
export MODBUS_PORT=1502  # matches mock server default
export MODBUS_DEFAULT_SLAVE_ID=1
uv run modbus-mcp
```

Then, from your MCP client, try tools:
- `read_register(address=0)` → Valve Position
- `write_register(address=1, value=50)` → Heater Power = 50%
- `read_input_registers(address=0, count=4)` → Temperature/Pressure/Flow/Tank Level
- `write_register(address=6, value=1)` → Start command (AUTO mode + pump on)

## Example (Python) Client

See `examples/client_example.py` for an async pymodbus client that reads/writes a few points.

## Troubleshooting

- Port in use → change `MODBUS_PORT`
- Permission denied on 502 → use 1502 (non-root)
- No response → confirm firewall, host/port, and that `modbus-mcp` points to this server
