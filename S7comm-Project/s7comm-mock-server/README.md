# s7comm-mock-server

Lightweight Siemens S7 mock built with `python-snap7`. It registers a handful of data blocks, inputs, outputs, and marker bytes so you can test the MCP servers locally without real hardware.

## Usage

```bash
uv sync
uv run s7comm-mock-server
```

By default the mock listens on `0.0.0.0:1102` and simulates:

- DB1: Motor telemetry (REAL values)
- DB2: Alarms and configuration bits
- Inputs: Sensors toggling periodically
- Outputs: Actuator commands (read/write)

Environment variables (or CLI args) let you tweak host, port, rack, slot, and update intervals. See `s7_mock_server.py --help` for the full list.

## Status

The script currently seeds a deterministic memory map and periodically mutates select values to mimic live plant data. Extend `s7_mock_server.py` to add scenarios, random jitter, command handling, or to consume JSON fixtures for more complex integration tests.
