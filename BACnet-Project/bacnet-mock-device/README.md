# bacnet-mock-device

Simple BACnet/IP mock for local testing. Rather than implementing the full BACnet stack, this scaffold provides a JSON-over-UDP bridge that mimics Who-Is/I-Am, property reads/writes, and COV-like updates so the MCP servers can be exercised without real controllers.

## Usage

```bash
uv sync
uv run bacnet-mock-device
```

Defaults:

- Listens on `127.0.0.1:7900`
- Responds to newline-delimited JSON commands:
  - `{ "op": "discover" }`
  - `{ "op": "read", "object": "analog-input:1", "property": "present-value" }`
  - `{ "op": "write", "object": "analog-output:1", "property": "present-value", "value": 50.0 }`

Extend `bacnet_mock_device.py` later to integrate with BAC0/bacpypes for real BACnet/IP behavior (COV notifications, schedules, alarms) per the roadmap.
