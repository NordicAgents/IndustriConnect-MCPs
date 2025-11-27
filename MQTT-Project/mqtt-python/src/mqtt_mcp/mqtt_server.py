#!/usr/bin/env python3
"""
MQTT + Sparkplug B MCP Server using FastMCP

Provides MCP tools for:
- Standard MQTT publish/subscribe
- Sparkplug B birth/death certificates
- Sparkplug B data and command messaging
"""

import asyncio
import os
import time
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Dict, List, Optional

import paho.mqtt.client as mqtt
from mcp.server.fastmcp import FastMCP, Context


# Configuration from environment
MQTT_BROKER_URL = os.getenv("MQTT_BROKER_URL", "mqtt://127.0.0.1:1883")
MQTT_CLIENT_ID = os.getenv("MQTT_CLIENT_ID", "mqtt-mcp-python")
MQTT_USERNAME = os.getenv("MQTT_USERNAME")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")
MQTT_KEEPALIVE = int(os.getenv("MQTT_KEEPALIVE", "60"))
SPARKPLUG_GROUP_ID = os.getenv("SPARKPLUG_GROUP_ID", "factory")
SPARKPLUG_EDGE_NODE_ID = os.getenv("SPARKPLUG_EDGE_NODE_ID", "edge-node-1")


# Parse broker URL
def parse_mqtt_url(url: str) -> tuple:
    """Parse mqtt://host:port to (host, port)."""
    if url.startswith("mqtt://"):
        url = url[7:]
    elif url.startswith("mqtts://"):
        url = url[8:]
    
    if ":" in url:
        host, port = url.split(":", 1)
        return (host, int(port))
    else:
        return (url, 1883)


MQTT_HOST, MQTT_PORT = parse_mqtt_url(MQTT_BROKER_URL)


class MQTTClientManager:
    """Manages MQTT client lifecycle and operations."""

    def __init__(self):
        self.client: Optional[mqtt.Client] = None
        self.connected = False
        self.subscriptions: set = set()
        self.sparkplug_sequence: Dict[str, int] = {}
        self.birth_certificates: Dict[str, Dict[str, Any]] = {}

    async def connect(self) -> None:
        """Connect to MQTT broker with automatic reconnection."""
        if self.connected and self.client:
            return

        def on_connect(client, userdata, flags, rc):
            if rc == 0:
                self.connected = True
            else:
                pass  # Connection failed, will retry automatically

        def on_disconnect(client, userdata, rc):
            if rc != 0:
                self.connected = False
            # Don't set connected=False on normal disconnect, let auto-reconnect handle it

        def on_message(client, userdata, msg):
            pass  # Message received silently

        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)
        self.client.on_connect = on_connect
        self.client.on_disconnect = on_disconnect
        self.client.on_message = on_message

        # Enable automatic reconnection with exponential backoff
        self.client.reconnect_delay_set(min_delay=1, max_delay=32)

        if MQTT_USERNAME and MQTT_PASSWORD:
            self.client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

        try:
            self.client.connect(MQTT_HOST, MQTT_PORT, keepalive=MQTT_KEEPALIVE)
            self.client.loop_start()
            # Give connection time to establish (but don't fail if it doesn't connect immediately)
            await asyncio.sleep(0.5)
        except Exception as e:
            # Continue even if connection fails - the client will retry automatically
            pass

    async def disconnect(self) -> None:
        """Disconnect from MQTT broker."""
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()
            self.connected = False

    async def publish(
        self, topic: str, payload: bytes, qos: int = 0, retain: bool = False
    ) -> None:
        """Publish a message."""
        if not self.client or not self.connected:
            raise RuntimeError("Not connected to MQTT broker")

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None, lambda: self.client.publish(topic, payload, qos=qos, retain=retain)
        )

    async def subscribe(self, topic: str, qos: int = 0) -> None:
        """Subscribe to a topic."""
        if not self.client or not self.connected:
            raise RuntimeError("Not connected to MQTT broker")

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, lambda: self.client.subscribe(topic, qos=qos))
        self.subscriptions.add(topic)

    async def unsubscribe(self, topic: str) -> None:
        """Unsubscribe from a topic."""
        if not self.client or not self.connected:
            raise RuntimeError("Not connected to MQTT broker")

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, lambda: self.client.unsubscribe(topic))
        self.subscriptions.discard(topic)

    def next_sequence(self, key: str) -> int:
        """Get next sequence number (0-255)."""
        if key not in self.sparkplug_sequence:
            self.sparkplug_sequence[key] = 0
        self.sparkplug_sequence[key] = (self.sparkplug_sequence[key] + 1) % 256
        return self.sparkplug_sequence[key]

    def encode_varint(self, value: int) -> bytes:
        """Encode a varint."""
        buf = bytearray()
        while (value & 0xffffff80) != 0:
            buf.append((value & 0xff) | 0x80)
            value >>= 7
        buf.append(value & 0xff)
        return bytes(buf)

    def encode_metric_protobuf(self, name: str, value: Any, metric_type: str) -> bytes:
        """Encode a single metric to protobuf."""
        parts = []
        # Field 1: name (string, wire type 2)
        name_bytes = name.encode("utf-8")
        parts.append(bytes([0x0a]))
        parts.append(self.encode_varint(len(name_bytes)))
        parts.append(name_bytes)
        
        # Field 2: timestamp (varint, wire type 0)
        parts.append(bytes([0x10]))
        parts.append(self.encode_varint(int(time.time() * 1000)))
        
        # Add value based on type
        metric_type = str(metric_type).lower()
        if metric_type in ("int", "int32"):
            # Field 5: int_value
            parts.append(bytes([0x28]))
            parts.append(self.encode_varint(int(value)))
        elif metric_type == "float":
            # Field 9: float_value (fixed32, wire type 5)
            parts.append(bytes([0x4d]))
            import struct
            parts.append(struct.pack("<f", float(value)))
        elif metric_type == "bool":
            # Field 11: boolean_value
            parts.append(bytes([0x58]))
            parts.append(bytes([1 if value else 0]))
        else:  # string
            # Field 12: string_value
            val_bytes = str(value).encode("utf-8")
            parts.append(bytes([0x62]))
            parts.append(self.encode_varint(len(val_bytes)))
            parts.append(val_bytes)
        
        return b"".join(parts)

    def encode_payload_protobuf(self, metrics: List[Dict[str, Any]], seq: int) -> bytes:
        """Encode a Sparkplug B payload."""
        parts = []
        
        # Field 1: timestamp (varint)
        parts.append(bytes([0x08]))
        parts.append(self.encode_varint(int(time.time() * 1000)))
        
        # Field 2: metrics (repeated message)
        for m in metrics:
            metric_bytes = self.encode_metric_protobuf(m["name"], m["value"], m.get("type", "string"))
            parts.append(bytes([0x12]))
            parts.append(self.encode_varint(len(metric_bytes)))
            parts.append(metric_bytes)
        
        # Field 3: seq (varint)
        parts.append(bytes([0x18]))
        parts.append(self.encode_varint(seq))
        
        return b"".join(parts)


@asynccontextmanager
async def mqtt_lifespan(server: FastMCP) -> AsyncIterator[dict]:
    """Manage MQTT client lifecycle."""
    manager = MQTTClientManager()
    try:
        await manager.connect()
        yield {"mqtt_manager": manager}
    finally:
        await manager.disconnect()


# Create MCP server
mcp = FastMCP("MQTT-Control", lifespan=mqtt_lifespan)


# Standard MQTT Tools

@mcp.tool()
async def publish_message(
    topic: str, payload: str, qos: int = 0, retain: bool = False, ctx: Context = None
) -> str:
    """
    Publish a message to an MQTT topic.
    
    Parameters:
        topic (str): MQTT topic name
        payload (str): Message payload
        qos (int): Quality of Service (0, 1, or 2)
        retain (bool): Retain message on broker
    """
    manager = ctx.request_context.lifespan_context["mqtt_manager"]
    try:
        await manager.publish(topic, payload.encode(), qos=qos, retain=retain)
        return f"Published to {topic} (QoS {qos}, retain={retain})"
    except Exception as e:
        return f"Error publishing to {topic}: {str(e)}"


@mcp.tool()
async def subscribe_topic(topic: str, qos: int = 0, ctx: Context = None) -> str:
    """
    Subscribe to an MQTT topic pattern.
    
    Parameters:
        topic (str): Topic pattern (supports +/# wildcards)
        qos (int): Quality of Service (0, 1, or 2)
    """
    manager = ctx.request_context.lifespan_context["mqtt_manager"]
    try:
        await manager.subscribe(topic, qos=qos)
        return f"Subscribed to {topic} (QoS {qos})"
    except Exception as e:
        return f"Error subscribing to {topic}: {str(e)}"


@mcp.tool()
async def unsubscribe_topic(topic: str, ctx: Context = None) -> str:
    """
    Unsubscribe from an MQTT topic.
    
    Parameters:
        topic (str): Topic name to unsubscribe from
    """
    manager = ctx.request_context.lifespan_context["mqtt_manager"]
    try:
        await manager.unsubscribe(topic)
        return f"Unsubscribed from {topic}"
    except Exception as e:
        return f"Error unsubscribing from {topic}: {str(e)}"


@mcp.tool()
def list_subscriptions(ctx: Context) -> str:
    """List active MQTT subscriptions."""
    manager = ctx.request_context.lifespan_context["mqtt_manager"]
    subs = list(manager.subscriptions)
    return f"Active subscriptions ({len(subs)}): {subs!r}"


@mcp.tool()
def get_broker_info(ctx: Context) -> str:
    """Get MQTT broker connection info and status."""
    manager = ctx.request_context.lifespan_context["mqtt_manager"]
    return f"Broker: {MQTT_HOST}:{MQTT_PORT}, Connected: {manager.connected}, Subscriptions: {len(manager.subscriptions)}"


# Sparkplug B Tools

@mcp.tool()
async def publish_node_birth(
    metrics: Optional[List[Dict[str, Any]]] = None, ctx: Context = None
) -> str:
    """
    Publish Sparkplug B Node Birth (NBIRTH) certificate.
    
    Parameters:
        metrics (list): Optional node metrics
    """
    manager = ctx.request_context.lifespan_context["mqtt_manager"]
    key = f"{SPARKPLUG_GROUP_ID}/{SPARKPLUG_EDGE_NODE_ID}"

    try:
        seq = manager.next_sequence(key)
        payload = manager.encode_payload_protobuf(metrics or [], seq)

        topic = f"spBv1.0/{SPARKPLUG_GROUP_ID}/NBIRTH/{SPARKPLUG_EDGE_NODE_ID}"
        await manager.publish(topic, payload, qos=1)

        manager.birth_certificates[key] = {"type": "NBIRTH", "timestamp": int(time.time() * 1000)}
        
        return f"Published NBIRTH to {topic} (seq={seq})"
    except Exception as e:
        return f"Error publishing NBIRTH: {str(e)}"


@mcp.tool()
async def publish_node_death(ctx: Context = None) -> str:
    """Publish Sparkplug B Node Death (NDEATH) certificate."""
    manager = ctx.request_context.lifespan_context["mqtt_manager"]
    key = f"{SPARKPLUG_GROUP_ID}/{SPARKPLUG_EDGE_NODE_ID}"

    try:
        seq = manager.next_sequence(key)
        payload = manager.encode_payload_protobuf([], seq)

        topic = f"spBv1.0/{SPARKPLUG_GROUP_ID}/NDEATH/{SPARKPLUG_EDGE_NODE_ID}"
        await manager.publish(topic, payload, qos=1)

        if key in manager.birth_certificates:
            del manager.birth_certificates[key]

        return f"Published NDEATH to {topic} (seq={seq})"
    except Exception as e:
        return f"Error publishing NDEATH: {str(e)}"


@mcp.tool()
async def publish_device_birth(
    device_id: str, metrics: List[Dict[str, Any]], ctx: Context = None
) -> str:
    """
    Publish Sparkplug B Device Birth (DBIRTH) certificate.
    
    Parameters:
        device_id (str): Device identifier
        metrics (list): Device metrics
    """
    manager = ctx.request_context.lifespan_context["mqtt_manager"]
    key = f"{SPARKPLUG_GROUP_ID}/{SPARKPLUG_EDGE_NODE_ID}/{device_id}"

    try:
        seq = manager.next_sequence(key)
        payload = manager.encode_payload_protobuf(metrics, seq)

        topic = f"spBv1.0/{SPARKPLUG_GROUP_ID}/DBIRTH/{SPARKPLUG_EDGE_NODE_ID}/{device_id}"
        await manager.publish(topic, payload, qos=1)

        manager.birth_certificates[key] = {
            "type": "DBIRTH",
            "device_id": device_id,
            "timestamp": int(time.time() * 1000),
        }

        return f"Published DBIRTH for {device_id} to {topic} (seq={seq})"
    except Exception as e:
        return f"Error publishing DBIRTH: {str(e)}"


@mcp.tool()
async def publish_device_death(device_id: str, ctx: Context = None) -> str:
    """
    Publish Sparkplug B Device Death (DDEATH) certificate.
    
    Parameters:
        device_id (str): Device identifier
    """
    manager = ctx.request_context.lifespan_context["mqtt_manager"]
    key = f"{SPARKPLUG_GROUP_ID}/{SPARKPLUG_EDGE_NODE_ID}/{device_id}"

    try:
        seq = manager.next_sequence(key)
        payload = manager.encode_payload_protobuf([], seq)

        topic = f"spBv1.0/{SPARKPLUG_GROUP_ID}/DDEATH/{SPARKPLUG_EDGE_NODE_ID}/{device_id}"
        await manager.publish(topic, payload, qos=1)

        if key in manager.birth_certificates:
            del manager.birth_certificates[key]

        return f"Published DDEATH for {device_id} to {topic} (seq={seq})"
    except Exception as e:
        return f"Error publishing DDEATH: {str(e)}"


@mcp.tool()
async def publish_node_data(metrics: List[Dict[str, Any]], ctx: Context = None) -> str:
    """
    Publish Sparkplug B Node Data (NDATA) update.
    
    Parameters:
        metrics (list): Updated node metrics
    """
    manager = ctx.request_context.lifespan_context["mqtt_manager"]
    key = f"{SPARKPLUG_GROUP_ID}/{SPARKPLUG_EDGE_NODE_ID}"

    if not metrics:
        return "Error: At least one metric is required"

    try:
        seq = manager.next_sequence(key)
        payload = manager.encode_payload_protobuf(metrics, seq)

        topic = f"spBv1.0/{SPARKPLUG_GROUP_ID}/NDATA/{SPARKPLUG_EDGE_NODE_ID}"
        await manager.publish(topic, payload, qos=0)

        return f"Published NDATA to {topic} (seq={seq}, {len(metrics)} metrics)"
    except Exception as e:
        return f"Error publishing NDATA: {str(e)}"


@mcp.tool()
async def publish_device_data(
    device_id: str, metrics: List[Dict[str, Any]], ctx: Context = None
) -> str:
    """
    Publish Sparkplug B Device Data (DDATA) update.
    
    Parameters:
        device_id (str): Device identifier
        metrics (list): Updated device metrics
    """
    manager = ctx.request_context.lifespan_context["mqtt_manager"]
    key = f"{SPARKPLUG_GROUP_ID}/{SPARKPLUG_EDGE_NODE_ID}/{device_id}"

    if not metrics:
        return "Error: At least one metric is required"

    try:
        seq = manager.next_sequence(key)
        payload = manager.encode_payload_protobuf(metrics, seq)

        topic = f"spBv1.0/{SPARKPLUG_GROUP_ID}/DDATA/{SPARKPLUG_EDGE_NODE_ID}/{device_id}"
        await manager.publish(topic, payload, qos=0)

        return f"Published DDATA for {device_id} to {topic} (seq={seq}, {len(metrics)} metrics)"
    except Exception as e:
        return f"Error publishing DDATA: {str(e)}"


@mcp.tool()
async def publish_node_command(metrics: List[Dict[str, Any]], ctx: Context = None) -> str:
    """
    Publish Sparkplug B Node Command (NCMD).
    
    Parameters:
        metrics (list): Command metrics
    """
    manager = ctx.request_context.lifespan_context["mqtt_manager"]
    key = f"{SPARKPLUG_GROUP_ID}/{SPARKPLUG_EDGE_NODE_ID}"

    if not metrics:
        return "Error: At least one metric is required"

    try:
        seq = manager.next_sequence(key)
        payload = manager.encode_payload_protobuf(metrics, seq)

        topic = f"spBv1.0/{SPARKPLUG_GROUP_ID}/NCMD/{SPARKPLUG_EDGE_NODE_ID}"
        await manager.publish(topic, payload, qos=0)

        return f"Published NCMD to {topic} (seq={seq}, {len(metrics)} metrics)"
    except Exception as e:
        return f"Error publishing NCMD: {str(e)}"


@mcp.tool()
async def publish_device_command(
    device_id: str, metrics: List[Dict[str, Any]], ctx: Context = None
) -> str:
    """
    Publish Sparkplug B Device Command (DCMD).
    
    Parameters:
        device_id (str): Device identifier
        metrics (list): Command metrics
    """
    manager = ctx.request_context.lifespan_context["mqtt_manager"]
    key = f"{SPARKPLUG_GROUP_ID}/{SPARKPLUG_EDGE_NODE_ID}/{device_id}"

    if not metrics:
        return "Error: At least one metric is required"

    try:
        seq = manager.next_sequence(key)
        payload = manager.encode_payload_protobuf(metrics, seq)

        topic = f"spBv1.0/{SPARKPLUG_GROUP_ID}/DCMD/{SPARKPLUG_EDGE_NODE_ID}/{device_id}"
        await manager.publish(topic, payload, qos=0)

        return f"Published DCMD for {device_id} to {topic} (seq={seq}, {len(metrics)} metrics)"
    except Exception as e:
        return f"Error publishing DCMD: {str(e)}"


@mcp.tool()
def list_sparkplug_nodes(ctx: Context) -> str:
    """List discovered Sparkplug B nodes and devices."""
    manager = ctx.request_context.lifespan_context["mqtt_manager"]
    nodes = []
    for key, cert in manager.birth_certificates.items():
        nodes.append({"key": key, **cert})
    
    return f"Discovered nodes ({len(nodes)}): {nodes!r}"


@mcp.tool()
def decode_sparkplug_payload(payload_hex: str, ctx: Context = None) -> str:
    """
    Decode a Sparkplug B protobuf payload.
    
    Parameters:
        payload_hex (str): Hex-encoded protobuf data
    """
    try:
        payload_bytes = bytes.fromhex(payload_hex)
        payload = sparkplug_b_pb2.Payload()
        payload.ParseFromString(payload_bytes)
        
        metrics = [
            {"name": m.name, "value": m.int_value or m.float_value or m.boolean_value or m.string_value}
            for m in payload.metrics
        ]
        
        return f"Decoded payload - seq={payload.seq}, timestamp={payload.timestamp}, metrics={metrics!r}"
    except Exception as e:
        return f"Error decoding payload: {str(e)}"


def main():
    """Run the MCP server."""
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()

