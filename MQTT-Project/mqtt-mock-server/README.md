# MQTT Mock Server with Sparkplug B Simulation

Local MQTT mock server for testing and development. Simulates an MQTT broker with Sparkplug B edge nodes, devices, and periodic metric updates.

## Features

- Embedded MQTT broker simulation (publishes to local network)
- Sparkplug B edge node with:
  - Node birth/death certificates (NBIRTH/NDEATH)
  - Multiple simulated devices with DBIRTH/DDEATH
  - Periodic NDATA and DDATA updates
  - Sequence number tracking
  - Proper timestamps
- Standard MQTT topics for basic testing
- Configurable via environment variables
- Graceful shutdown with proper cleanup

## Quick Start

```bash
cd mqtt-mock-server
uv sync
uv run mqtt-mock-server
```

## Configuration

Environment variables:

- `MQTT_BROKER_HOST` - Broker address (default: `127.0.0.1`)
- `MQTT_BROKER_PORT` - Broker port (default: `1883`)
- `SPARKPLUG_GROUP_ID` - Sparkplug B group ID (default: `factory`)
- `SPARKPLUG_EDGE_NODE_ID` - Edge node ID (default: `edge-node-1`)
- `UPDATE_INTERVAL` - Metric update interval in seconds (default: `2.0`)

Example with custom configuration:

```bash
MQTT_BROKER_HOST=localhost \
MQTT_BROKER_PORT=1883 \
SPARKPLUG_GROUP_ID=production \
SPARKPLUG_EDGE_NODE_ID=edge-1 \
UPDATE_INTERVAL=1.0 \
uv run mqtt-mock-server
```

## Topic Map

### Sparkplug B Topics

**Node Topics:**
- `spBv1.0/{GROUP_ID}/NBIRTH/{EDGE_NODE_ID}` - Node birth certificate
- `spBv1.0/{GROUP_ID}/NDEATH/{EDGE_NODE_ID}` - Node death certificate
- `spBv1.0/{GROUP_ID}/NDATA/{EDGE_NODE_ID}` - Node data updates
- `spBv1.0/{GROUP_ID}/NCMD/{EDGE_NODE_ID}` - Node commands (listen-only)

**Device Topics:**
- `spBv1.0/{GROUP_ID}/DBIRTH/{EDGE_NODE_ID}/{DEVICE_ID}` - Device birth
- `spBv1.0/{GROUP_ID}/DDEATH/{EDGE_NODE_ID}/{DEVICE_ID}` - Device death
- `spBv1.0/{GROUP_ID}/DDATA/{EDGE_NODE_ID}/{DEVICE_ID}` - Device data updates
- `spBv1.0/{GROUP_ID}/DCMD/{EDGE_NODE_ID}/{DEVICE_ID}` - Device commands (listen-only)

### Standard MQTT Topics

- `sensors/temperature` - Temperature reading (°C)
- `sensors/pressure` - Pressure reading (kPa)
- `sensors/humidity` - Humidity reading (%)
- `control/pump` - Pump status and speed
- `control/valve` - Valve position and status
- `system/status` - System uptime and health

## Simulated Devices

### Device 1: Sensor Array
- **Topic:** `spBv1.0/factory/D{BIRTH|DATA}/edge-node-1/device-1`
- **Metrics:**
  - `temperature` (float, °C) - Varies sinusoidally
  - `pressure` (float, kPa) - Varies with cosine
  - `flow_rate` (float, L/min) - Varies sinusoidally

### Device 2: Control Module
- **Topic:** `spBv1.0/factory/D{BIRTH|DATA}/edge-node-1/device-2`
- **Metrics:**
  - `pump_speed` (int, %) - 0-100
  - `valve_position` (int, %) - 0-100
  - `enabled` (bool) - On/off

## Node Metrics

- `uptime` (int, seconds) - Time since node birth
- `status` (string) - Node status ("online", "offline", etc.)

## Testing with MCP Servers

Once the mock server is running on port 1883, connect your MCP server:

```bash
# Terminal 1 - Start mock server
cd mqtt-mock-server
uv run mqtt-mock-server

# Terminal 2 - Start MCP server
cd ../mqtt-npm
export MQTT_BROKER_URL=127.0.0.1
export MQTT_BROKER_PORT=1883
npm run build
node build/index.js
```

Then use MCP tools to:
- Subscribe to topics and receive data
- Publish commands to devices
- Monitor Sparkplug B birth/death certificates
- Read metric values

## Common Test Operations

### Read device metrics

```json
{
  "tool": "publish_message",
  "parameters": {
    "topic": "spBv1.0/factory/DDATA/edge-node-1/device-1",
    "payload": "",
    "qos": 0
  }
}
```

### Monitor all device data

Subscribe to:
```
spBv1.0/factory/DDATA/edge-node-1/+
```

### Monitor all standard topics

Subscribe to:
```
sensors/#
control/#
system/#
```

## Architecture

The mock server:
1. Connects to a local MQTT broker simulator
2. Publishes NBIRTH to announce the edge node
3. Publishes DBIRTH for each device (device-1, device-2)
4. Every UPDATE_INTERVAL seconds:
   - Publishes NDATA with node metrics
   - Publishes DDATA for each device with updated metrics
   - Publishes standard MQTT topic updates
5. On shutdown, publishes DDEATH for each device, then NDEATH for the node

## Limitations

- This is a mock server that publishes data; it doesn't simulate a full MQTT broker
- Subscriptions are not processed (no message queuing)
- QoS 0 (at-most-once delivery) is simplified
- No authentication or encryption
- Designed for local testing only

## Dependencies

- `paho-mqtt>=1.6.1` - MQTT client
- `sparkplug-b>=1.0.12` - Sparkplug B protobuf definitions
- `protobuf>=4.24.0` - Protobuf serialization

