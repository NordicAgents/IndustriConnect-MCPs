# ethercat-mock-slave

Minimalist EtherCAT slave simulator for quick MCP smoke tests. Instead of speaking raw EtherCAT, the current scaffold exposes a TCP JSON API that mimics network scans and PDO buffers until a proper SOEM-based mock is implemented.

## Usage

```bash
uv sync
uv run ethercat-mock-slave
```

Defaults:

- Listens on `127.0.0.1:6700`
- Accepts newline-delimited JSON commands:
  - `{ "op": "scan" }`
  - `{ "op": "read_pdo", "position": 0, "length": 8 }`
  - `{ "op": "write_pdo", "position": 0, "data": [1,0,0,0] }`

Flags/ENV allow adjusting host, port, and update interval. Extend `ethercat_mock_slave.py` later to hook into real SOEM slave stacks, state machines, and ESI generation as per the roadmap.
