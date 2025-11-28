# melsec-mock-plc

Minimal MELSEC MC protocol mock. Instead of implementing the full MC frame set, this scaffold exposes a JSON-over-TCP interface that mimics device memory reads/writes so MCP servers can be exercised locally.

## Usage

```bash
uv sync
uv run melsec-mock-plc
```

Defaults:

- Listens on `127.0.0.1:8100`
- Accepts newline-delimited JSON commands:
  - `{ "op": "read", "device_type": "D", "start_address": 0, "count": 4 }`
  - `{ "op": "write", "device_type": "D", "start_address": 0, "values": [1,2,3,4] }`

Extend `melsec_mock_plc.py` later to handle actual MC protocol frames, batch operations, remote run/stop, etc., per the roadmap.
