# ethernetip-mock-server

Developer-focused mock PLC that emulates a handful of EtherNet/IP tags, arrays, and status bits. It does **not** implement the full CIP protocol yet, but it exposes an in-memory tag database with a simple JSON-over-TCP bridge so you can exercise the MCP servers without a Rockwell controller.

## Usage

```bash
uv sync
uv run ethernetip-mock-server
```

By default the mock listens on `127.0.0.1:5025` for JSON requests:

```json
{ "op": "read", "tag": "Program:MainProgram.MotorSpeed" }
{ "op": "write", "tag": "Program:MainProgram.MotorSpeed", "value": 1200.0 }
```

Use `--help` for configuration flags (host, port, auto-update cadence, seed file). The MCP servers can talk to this mock by pointing their `ENIP_HOST` to `127.0.0.1` and enabling the optional JSON bridge adapter (planned).

> **Note:** This is a scaffold meant for rapid development—the CIP front-end is still a TODO. Extend `eip_mock_server.py` to translate between the JSON protocol and a true EtherNet/IP stack or to pipe data into higher-level tests.
