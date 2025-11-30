# profinet-mock-server

Toy PROFINET IO device for local testing. Instead of speaking raw PROFINET on the wire (planned), the current scaffold exposes a JSON-over-TCP bridge that mimics device discovery and I/O payloads for the MCP servers.

## Usage

```bash
uv sync
uv run profinet-mock-server
```

Defaults:

- Listens on `127.0.0.1:5600`
- Responds to JSON lines:
  - `{ "op": "discover" }`
  - `{ "op": "read", "device": "PN-DEVICE-01", "slot": 1, "subslot": 1, "length": 8 }`
  - `{ "op": "write", "device": "PN-DEVICE-01", "slot": 1, "subslot": 1, "data": [1,0,0,0] }`

Use `--help` to configure port, host, and auto-update cadence. Extend `profinet_mock_device.py` to add actual DCP handling, diagnostics, and richer module behavior once the MCP servers require it.
