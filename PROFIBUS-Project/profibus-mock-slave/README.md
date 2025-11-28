# profibus-mock-slave

Simple PROFIBUS DP slave simulator for local testing. Instead of implementing the full fieldbus, it exposes a TCP JSON protocol that mimics bus scans, I/O buffers, and diagnostics so the MCP servers can be exercised without hardware.

## Usage

```bash
uv sync
uv run profibus-mock-slave
```

Defaults:

- Listens on `127.0.0.1:7100`
- Supports JSON commands:
  - `{ "op": "scan" }`
  - `{ "op": "read_inputs", "address": 5, "length": 4 }`
  - `{ "op": "write_outputs", "address": 5, "data": [1,0,0,0] }`
  - `{ "op": "diagnosis", "address": 5 }`

Flags/ENV let you adjust host, port, update interval, and initial slave list. Extend `profibus_mock_slave.py` later to integrate with a real PROFIBUS stack, parameter blocks, and diagnostics as described in the roadmap.
