# MQTT + Sparkplug B MCP Project

A Model Context Protocol (MCP) server suite for MQTT and Sparkplug B that lets AI agents and MCP‑compatible apps publish, subscribe, and manage industrial IoT messaging. This repository contains:

- **mqtt-python** - Full‑featured Python MCP server using FastMCP (uv managed)
- **mqtt-npm** - NPX‑friendly MCP server built with TypeScript/Node.js
- **mqtt-mock-server** - Python-based MQTT broker simulator with Sparkplug B edge node simulation

Both MCP servers expose the same tool names and semantics so you can pick the runtime that fits your stack.

## Features

### Standard MQTT

- **Publish** with QoS (0, 1, 2) and retain flags
- **Subscribe** to topic patterns with wildcard support (+, #)
- **Unsubscribe** and manage subscriptions
- **Broker info** reporting
- Automatic reconnection and error handling

### Sparkplug B (Full Spec Compliance)

- **Birth Certificates** (NBIRTH, DBIRTH) with metric definitions
- **Death Certificates** (NDEATH, DDEATH) for graceful cleanup
- **Data Messages** (NDATA, DDATA) with metric updates
- **Commands** (NCMD, DCMD) for device control
- **Protobuf encoding/decoding** with full type support
- **Sequence number tracking** per namespace
- **Timestamp handling** with millisecond precision

### Mock Server

- Simulated MQTT broker with Sparkplug B edge nodes
- Multiple devices with periodic metric updates
- Birth/death certificate publishing
- Standard MQTT topics for testing
- Environment-configurable behavior

## Repo Layout

```
MQTT-Project/
├── mqtt-python/           — Python MCP server (mqtt-mcp entrypoint)
├── mqtt-npm/              — NPX/Node MCP server (mqtt-mcp bin)
├── mqtt-mock-server/      — Local MQTT simulator (default port 1883)
└── README.md              — This file
```

## Quick Start (Local)

### 1. Start the mock server

```bash
cd mqtt-mock-server
uv sync
uv run mqtt-mock-server  # listens on 127.0.0.1:1883
```

### 2. Run an MCP server (choose Python or NPX)

**Python (uv):**
```bash
cd ../mqtt-python
export MQTT_BROKER_URL=mqtt://127.0.0.1:1883
export SPARKPLUG_GROUP_ID=factory
export SPARKPLUG_EDGE_NODE_ID=edge-node-1
uv sync
uv run mqtt-mcp
```

**Node/NPX (local build):**
```bash
cd ../mqtt-npm
npm install
npm run build
MQTT_BROKER_URL=mqtt://127.0.0.1:1883 \
SPARKPLUG_GROUP_ID=factory \
SPARKPLUG_EDGE_NODE_ID=edge-node-1 \
node build/index.js
```

Both servers communicate over stdio as per MCP.

## MCP Client Examples

### Claude Desktop

**Python server (uv):**
```json
{
  "mcpServers": {
    "MQTT MCP (Python)": {
      "command": "uv",
      "args": ["--directory", "/absolute/path/to/mqtt-python", "run", "mqtt-mcp"],
      "env": { 
        "MQTT_BROKER_URL": "mqtt://127.0.0.1:1883",
        "SPARKPLUG_GROUP_ID": "factory",
        "SPARKPLUG_EDGE_NODE_ID": "edge-node-1"
      }
    }
  }
}
```

**NPX server (Node):**
```json
{
  "mcpServers": {
    "MQTT MCP (NPX)": {
      "command": "mqtt-mcp",
      "env": {
        "MQTT_BROKER_URL": "mqtt://127.0.0.1:1883",
        "SPARKPLUG_GROUP_ID": "factory",
        "SPARKPLUG_EDGE_NODE_ID": "edge-node-1"
      }
    }
  }
}
```

For local builds, use `"command": "node"` and set `"args"` to the absolute path of `mqtt-npm/build/index.js`.

### MCP Inspector / CLI

You can also use any MCP runner that connects to a stdio server. The tools are listed via MCP's `list_tools` and invoked with `call_tool`.

## Tools and Example Calls

All tools return structured results with `success`, `data`, `error`, and `meta` fields.

### Standard MQTT

- Publish to a topic
```json
{ "tool": "publish_message", "parameters": { "topic": "sensors/temp", "payload": "22.5", "qos": 1 } }
```

- Subscribe to a pattern
```json
{ "tool": "subscribe_topic", "parameters": { "topic": "sensors/#", "qos": 1 } }
```

- Unsubscribe
```json
{ "tool": "unsubscribe_topic", "parameters": { "topic": "sensors/#" } }
```

- List subscriptions
```json
{ "tool": "list_subscriptions", "parameters": {} }
```

- Get broker info
```json
{ "tool": "get_broker_info", "parameters": {} }
```

### Sparkplug B

- Publish Node Birth
```json
{ 
  "tool": "publish_node_birth", 
  "parameters": { 
    "metrics": [
      {"name": "uptime", "value": 0, "type": "int32"},
      {"name": "status", "value": "online", "type": "string"}
    ]
  } 
}
```

- Publish Device Birth
```json
{ 
  "tool": "publish_device_birth", 
  "parameters": { 
    "device_id": "device-1",
    "metrics": [
      {"name": "temperature", "value": 22.5, "type": "float"},
      {"name": "enabled", "value": true, "type": "boolean"}
    ]
  } 
}
```

- Publish Device Data
```json
{ 
  "tool": "publish_device_data", 
  "parameters": { 
    "device_id": "device-1",
    "metrics": [
      {"name": "temperature", "value": 23.1, "type": "float"}
    ]
  } 
}
```

- Send Device Command
```json
{ 
  "tool": "publish_device_command", 
  "parameters": { 
    "device_id": "device-1",
    "metrics": [
      {"name": "pump_speed", "value": 75, "type": "int32"}
    ]
  } 
}
```

- List discovered nodes
```json
{ "tool": "list_sparkplug_nodes", "parameters": {} }
```

- Decode Sparkplug payload (hex)
```json
{ 
  "tool": "decode_sparkplug_payload", 
  "parameters": { "payload_hex": "1a0f74656d70657261747572650915000000414200000000" } 
}
```

## Environment Variables

### MQTT Connection

- `MQTT_BROKER_URL` - Broker URL (default: `mqtt://127.0.0.1:1883`)
  - Format: `mqtt://host:port` or `mqtts://host:port`
- `MQTT_CLIENT_ID` - Client identifier (default: `mqtt-mcp-client`)
- `MQTT_USERNAME` - Optional username
- `MQTT_PASSWORD` - Optional password
- `MQTT_KEEPALIVE` - Keep-alive in seconds (default: `60`)

### Sparkplug B Namespace

- `SPARKPLUG_GROUP_ID` - Group ID for Sparkplug topics (default: `factory`)
- `SPARKPLUG_EDGE_NODE_ID` - Edge node ID (default: `edge-node-1`)

## Sparkplug B Namespace Structure

The servers follow the official Sparkplug B 3.0 namespace:

```
spBv1.0/<GROUP_ID>/NBIRTH/<EDGE_NODE_ID>         - Node birth
spBv1.0/<GROUP_ID>/NDEATH/<EDGE_NODE_ID>         - Node death
spBv1.0/<GROUP_ID>/NDATA/<EDGE_NODE_ID>          - Node data
spBv1.0/<GROUP_ID>/NCMD/<EDGE_NODE_ID>           - Node commands

spBv1.0/<GROUP_ID>/DBIRTH/<EDGE_NODE_ID>/<DEVICE_ID>   - Device birth
spBv1.0/<GROUP_ID>/DDEATH/<EDGE_NODE_ID>/<DEVICE_ID>   - Device death
spBv1.0/<GROUP_ID>/DDATA/<EDGE_NODE_ID>/<DEVICE_ID>    - Device data
spBv1.0/<GROUP_ID>/DCMD/<EDGE_NODE_ID>/<DEVICE_ID>     - Device commands
```

## Data Types

Sparkplug B supports the following metric data types:

- **int32** - 32-bit signed integer
- **float** - 32-bit IEEE 754 float
- **boolean** - True/false value
- **string** - UTF-8 string

## Testing With The Mock Server

### Basic MQTT Test

1. Subscribe to all sensors:
```json
{ "tool": "subscribe_topic", "parameters": { "topic": "sensors/#" } }
```

2. Mock server will publish to:
   - `sensors/temperature` → 22.5 ± 2°C (sinusoidal)
   - `sensors/pressure` → 101.3 ± 1 kPa (cosine)
   - `sensors/humidity` → 55%

### Sparkplug B Test

1. List discovered nodes:
```json
{ "tool": "list_sparkplug_nodes", "parameters": {} }
```

2. You'll see the mock edge node and devices (device-1, device-2)

3. Subscribe to device data:
```json
{ "tool": "subscribe_topic", "parameters": { "topic": "spBv1.0/factory/DDATA/edge-node-1/+" } }
```

4. Mock server publishes device metrics every 2 seconds

5. Send a command to device:
```json
{ 
  "tool": "publish_device_command", 
  "parameters": { 
    "device_id": "device-1",
    "metrics": [
      {"name": "pump_speed", "value": 80, "type": "int32"}
    ]
  } 
}
```

## Example Commands

### Getting Started

**Check broker connection status:**
```json
{ "tool": "get_broker_info", "parameters": {} }
```

**List active subscriptions:**
```json
{ "tool": "list_subscriptions", "parameters": {} }
```

### Reading Sensor Data

**Subscribe to all temperature sensors:**
```json
{ "tool": "subscribe_topic", "parameters": { "topic": "sensors/temperature", "qos": 1 } }
```

**Subscribe to all sensors (wildcard):**
```json
{ "tool": "subscribe_topic", "parameters": { "topic": "sensors/#", "qos": 1 } }
```

**Subscribe to all Sparkplug device data:**
```json
{ "tool": "subscribe_topic", "parameters": { "topic": "spBv1.0/factory/DDATA/edge-node-1/+", "qos": 1 } }
```

**Discover available Sparkplug nodes and devices:**
```json
{ "tool": "list_sparkplug_nodes", "parameters": {} }
```

### Publishing Data

**Publish a temperature reading:**
```json
{ "tool": "publish_message", "parameters": { "topic": "sensors/temperature", "payload": "23.5", "qos": 1, "retain": false } }
```

**Publish JSON sensor data:**
```json
{ "tool": "publish_message", "parameters": { "topic": "sensors/custom", "payload": "{\"temp\": 24.2, \"humidity\": 60}", "qos": 1 } }
```

**Publish Sparkplug device data update:**
```json
{ 
  "tool": "publish_device_data", 
  "parameters": { 
    "device_id": "device-1",
    "metrics": [
      {"name": "temperature", "value": 24.3, "type": "float"},
      {"name": "pressure", "value": 102.1, "type": "float"}
    ]
  } 
}
```

### Controlling Devices

**Set pump speed to 75%:**
```json
{ 
  "tool": "publish_device_command", 
  "parameters": { 
    "device_id": "device-2",
    "metrics": [
      {"name": "pump_speed", "value": 75, "type": "int32"}
    ]
  } 
}
```

**Control valve position:**
```json
{ 
  "tool": "publish_device_command", 
  "parameters": { 
    "device_id": "device-2",
    "metrics": [
      {"name": "valve_position", "value": 65, "type": "int32"}
    ]
  } 
}
```

**Enable/disable device:**
```json
{ 
  "tool": "publish_device_command", 
  "parameters": { 
    "device_id": "device-2",
    "metrics": [
      {"name": "enabled", "value": true, "type": "boolean"}
    ]
  } 
}
```

### Managing Subscriptions

**Unsubscribe from a topic:**
```json
{ "tool": "unsubscribe_topic", "parameters": { "topic": "sensors/temperature" } }
```

**Unsubscribe from all sensors:**
```json
{ "tool": "unsubscribe_topic", "parameters": { "topic": "sensors/#" } }
```

### Complete Workflow Examples

**Monitor all sensors:**
```json
// Step 1: Subscribe to all sensor topics
{ "tool": "subscribe_topic", "parameters": { "topic": "sensors/#", "qos": 1 } }

// Step 2: Subscribe to Sparkplug device data
{ "tool": "subscribe_topic", "parameters": { "topic": "spBv1.0/factory/DDATA/edge-node-1/+", "qos": 1 } }

// Step 3: Check what you're subscribed to
{ "tool": "list_subscriptions", "parameters": {} }
```

**Create and manage a device:**
```json
// Step 1: Publish device birth certificate
{ 
  "tool": "publish_device_birth", 
  "parameters": { 
    "device_id": "my-sensor",
    "metrics": [
      {"name": "temperature", "value": 22.5, "type": "float"},
      {"name": "humidity", "value": 55.0, "type": "float"}
    ]
  } 
}

// Step 2: Update device data periodically
{ 
  "tool": "publish_device_data", 
  "parameters": { 
    "device_id": "my-sensor",
    "metrics": [
      {"name": "temperature", "value": 23.1, "type": "float"}
    ]
  } 
}

// Step 3: Publish device death when shutting down
{ 
  "tool": "publish_device_death", 
  "parameters": { 
    "device_id": "my-sensor"
  } 
}
```

**Node lifecycle management:**
```json
// Step 1: Publish node birth
{ 
  "tool": "publish_node_birth", 
  "parameters": { 
    "metrics": [
      {"name": "uptime", "value": 0, "type": "int32"},
      {"name": "status", "value": "online", "type": "string"}
    ]
  } 
}

// Step 2: Update node data (e.g., every minute)
{ 
  "tool": "publish_node_data", 
  "parameters": { 
    "metrics": [
      {"name": "uptime", "value": 3600, "type": "int32"},
      {"name": "status", "value": "online", "type": "string"}
    ]
  } 
}

// Step 3: Publish node death on shutdown
{ "tool": "publish_node_death", "parameters": {} }
```

## Development

### Python Version

- Requires Python 3.10+ and uv
- From `mqtt-python`: `uv sync`, then `uv run mqtt-mcp`
- Uses FastMCP for async tool handlers

### Node/TypeScript Version

- From `mqtt-npm`: `npm install`, `npm run build`, then `node build/index.js`
- Uses @modelcontextprotocol/sdk

### Mock Server

- From `mqtt-mock-server`: `uv sync`, then `uv run mqtt-mock-server`
- Simulates MQTT broker with Sparkplug B nodes

## Troubleshooting

### Connection Refused

**Issue:** `ECONNREFUSED` when connecting to broker
- **Solution:** Ensure mock server is running: `cd mqtt-mock-server && uv run mqtt-mock-server`
- Check broker address and port match (default: `127.0.0.1:1883`)

### No Devices Appearing

**Issue:** `list_sparkplug_nodes` returns empty
- **Solution:** Wait a few seconds after starting mock server for NBIRTH to publish
- Ensure you're subscribed to or have published to Sparkplug topics

### Sequence Number Errors

**Issue:** Sequence mismatch when publishing
- **Solution:** Sequence numbers are tracked per namespace key and auto-increment
- Each message type (NBIRTH, NDATA, etc.) shares the same sequence counter per node/device

### Type Conversion Errors

**Issue:** `Cannot convert value to type`
- **Solution:** Ensure metric values match their declared types
- Use integers for "int32", floats for "float", true/false for "boolean", strings for "string"

## Performance Notes

- MQTT QoS 0 is fastest but provides no delivery guarantee
- QoS 1 and 2 provide delivery guarantees at the cost of latency
- Sparkplug B birth certificates (NBIRTH/DBIRTH) use QoS 1 for reliability
- Data updates (NDATA/DDATA) use QoS 0 for low latency
- Sequence numbers wrap at 256 (0-255)

## Security

The mock server is **not secure** and designed for local development only:
- No TLS/SSL support
- No authentication
- Runs on localhost by default

For production use:
- Use a production MQTT broker with authentication
- Enable TLS/SSL encryption
- Implement proper ACLs on topics
- Use environment variables for secrets (avoid hardcoding credentials)

## License

See individual package folders for license details.

## Related Resources

- [Sparkplug B Specification](https://www.eclipse.org/tahu/spec/)
- [MQTT 3.1.1 Specification](https://mqtt.org/mqtt-specification-v3-1-1)
- [MCP Documentation](https://modelcontextprotocol.io/)
- [paho-mqtt Python Library](https://github.com/eclipse/paho.mqtt.python)
- [Eclipse Tahu Sparkplug Libraries](https://github.com/eclipse/tahu)

