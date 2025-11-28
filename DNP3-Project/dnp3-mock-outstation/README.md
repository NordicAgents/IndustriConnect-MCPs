# dnp3-mock-outstation

Development outstation for DNP3. Instead of a full protocol stack, the current scaffold exposes a TCP JSON service that mimics point reads, controls, and class polls so the MCP servers can be exercised locally.

## Usage

```bash
uv sync
uv run dnp3-mock-outstation
```

Defaults:

- Listens on `127.0.0.1:7300`
- Supports JSON commands:
  - `{ "op": "read", "type": "binary", "start": 0, "count": 8 }`
  - `{ "op": "read", "type": "analog", "start": 0, "count": 4 }`
  - `{ "op": "write_binary", "index": 5, "value": true }`
  - `{ "op": "poll_class", "class": 1 }`

Extend `dnp3_mock_outstation.py` later to hook into `pydnp3`, simulate events, unsolicited responses, time synchronization, and file transfer per the roadmap.
