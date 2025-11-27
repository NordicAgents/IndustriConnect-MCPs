# MQTT MCP Server (TypeScript/Node.js)

TypeScript/Node.js implementation of an MQTT + Sparkplug B MCP server using the @modelcontextprotocol/sdk.

## Installation

```bash
npm install
npm run build
```

## Usage

### Local Development

```bash
export MQTT_BROKER_URL=mqtt://127.0.0.1:1883
export MQTT_CLIENT_ID=mqtt-mcp-client
export SPARKPLUG_GROUP_ID=factory
export SPARKPLUG_EDGE_NODE_ID=edge-node-1
npm run build
node build/index.js
```

### With NPX (from npm registry)

```bash
export MQTT_BROKER_URL=mqtt://127.0.0.1:1883
npx mqtt-mcp
```

## Configuration

Environment variables:

- `MQTT_BROKER_URL` - MQTT broker address (default: `mqtt://127.0.0.1:1883`)
- `MQTT_CLIENT_ID` - MQTT client identifier (default: `mqtt-mcp-client`)
- `MQTT_USERNAME` - Optional authentication username
- `MQTT_PASSWORD` - Optional authentication password
- `MQTT_KEEPALIVE` - Keep-alive interval in seconds (default: `60`)
- `SPARKPLUG_GROUP_ID` - Sparkplug B group ID (default: `factory`)
- `SPARKPLUG_EDGE_NODE_ID` - Sparkplug B edge node ID (default: `edge-node-1`)

## Tools

### Standard MQTT Tools

#### `publish_message`
Publish a message to any MQTT topic.

**Parameters:**
- `topic` (string, required) - Topic name
- `payload` (string, required) - Message payload
- `qos` (number, optional, 0-2) - Quality of Service level
- `retain` (boolean, optional) - Retain message on broker

**Example:**
```json
{
  "tool": "publish_message",
  "parameters": {
    "topic": "sensors/temperature",
    "payload": "{\"value\": 22.5, \"unit\": \"C\"}",
    "qos": 1
  }
}
```

#### `subscribe_topic`
Subscribe to an MQTT topic pattern.

**Parameters:**
- `topic` (string, required) - Topic pattern (supports +/# wildcards)
- `qos` (number, optional, 0-2) - Quality of Service level

**Example:**
```json
{
  "tool": "subscribe_topic",
  "parameters": {
    "topic": "sensors/#",
    "qos": 1
  }
}
```

#### `unsubscribe_topic`
Unsubscribe from an MQTT topic.

**Parameters:**
- `topic` (string, required) - Topic name

#### `list_subscriptions`
List currently active subscriptions.

#### `get_broker_info`
Get connection info and status of the MQTT broker.

### Sparkplug B Tools

#### `publish_node_birth`
Publish a Sparkplug B Node Birth (NBIRTH) certificate.

**Parameters:**
- `metrics` (array, optional) - Node metrics:
  - `name` (string, required) - Metric name
  - `value` (number/string/boolean, required) - Metric value
  - `type` (string, required) - Data type: "int32", "float", "boolean", "string"

**Example:**
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

#### `publish_node_death`
Publish a Sparkplug B Node Death (NDEATH) certificate.

#### `publish_device_birth`
Publish a Sparkplug B Device Birth (DBIRTH) certificate.

**Parameters:**
- `device_id` (string, required) - Device identifier
- `metrics` (array, required) - Device metrics (same format as NBIRTH)

#### `publish_device_death`
Publish a Sparkplug B Device Death (DDEATH) certificate.

**Parameters:**
- `device_id` (string, required) - Device identifier

#### `publish_node_data`
Publish Sparkplug B Node Data (NDATA) with updated metrics.

**Parameters:**
- `metrics` (array, required) - Updated node metrics

#### `publish_device_data`
Publish Sparkplug B Device Data (DDATA) with updated metrics.

**Parameters:**
- `device_id` (string, required) - Device identifier
- `metrics` (array, required) - Updated device metrics

#### `publish_node_command`
Publish a Sparkplug B Node Command (NCMD).

**Parameters:**
- `metrics` (array, required) - Command metrics

#### `publish_device_command`
Publish a Sparkplug B Device Command (DCMD).

**Parameters:**
- `device_id` (string, required) - Device identifier
- `metrics` (array, required) - Command metrics

#### `list_sparkplug_nodes`
List discovered Sparkplug B nodes and their birth certificates.

#### `decode_sparkplug_payload`
Decode a hex-encoded Sparkplug B protobuf payload (for debugging).

**Parameters:**
- `payload_hex` (string, required) - Hex-encoded protobuf data

## Usage with Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mqtt-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/mqtt-npm/build/index.js"],
      "env": {
        "MQTT_BROKER_URL": "mqtt://127.0.0.1:1883",
        "SPARKPLUG_GROUP_ID": "factory",
        "SPARKPLUG_EDGE_NODE_ID": "edge-node-1"
      }
    }
  }
}
```

Or using npx (after publishing to npm):

```json
{
  "mcpServers": {
    "mqtt-mcp": {
      "command": "npx",
      "args": ["mqtt-mcp"],
      "env": {
        "MQTT_BROKER_URL": "mqtt://127.0.0.1:1883",
        "SPARKPLUG_GROUP_ID": "factory",
        "SPARKPLUG_EDGE_NODE_ID": "edge-node-1"
      }
    }
  }
}
```

## Dependencies

- `@modelcontextprotocol/sdk` - MCP framework
- `mqtt` - MQTT client library
- `sparkplug-payload` - Sparkplug B protobuf encoding/decoding
- `typescript` - TypeScript compiler (dev)
- `@types/node` - Node.js type definitions (dev)

## Building

```bash
npm run build
```

Compiled output goes to `build/` directory.

## Running Tests

Connect to a running MQTT broker (e.g., the mock server) and test tools via Claude Desktop or MCP inspector.

