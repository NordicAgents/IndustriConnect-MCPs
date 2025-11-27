#!/usr/bin/env python3
"""
MQTT Mock Server with Sparkplug B Edge Node Simulation

Simulates an MQTT broker with:
- Embedded Sparkplug B edge nodes
- Periodic metric updates
- Birth/death certificate handling
- Standard MQTT topics for testing
"""

import asyncio
import json
import math
import os
import signal
import sys
import time
from datetime import datetime
from typing import Dict, List, Optional

import paho.mqtt.client as mqtt
from google.protobuf import message


# Configuration from environment
BROKER_HOST = os.getenv("MQTT_BROKER_HOST", "127.0.0.1")
BROKER_PORT = int(os.getenv("MQTT_BROKER_PORT", "1883"))
SPARKPLUG_GROUP_ID = os.getenv("SPARKPLUG_GROUP_ID", "factory")
SPARKPLUG_EDGE_NODE_ID = os.getenv("SPARKPLUG_EDGE_NODE_ID", "edge-node-1")
UPDATE_INTERVAL = float(os.getenv("UPDATE_INTERVAL", "2.0"))  # seconds


class SparkplugBSimulator:
    """Simulates a Sparkplug B edge node with devices and metrics."""

    def __init__(self, client: mqtt.Client):
        self.client = client
        self.group_id = SPARKPLUG_GROUP_ID
        self.edge_node_id = SPARKPLUG_EDGE_NODE_ID
        self.sequence = 0
        self.namespace = f"spBv1.0/{self.group_id}/EONB/{self.edge_node_id}"
        self.start_time = time.time()  # Track when node started
        self.devices = {
            "device-1": {
                "name": "Sensor Array 1",
                "metrics": {
                    "temperature": {"value": 22.5, "type": "float", "unit": "°C"},
                    "pressure": {"value": 101.3, "type": "float", "unit": "kPa"},
                    "flow_rate": {"value": 45.2, "type": "float", "unit": "L/min"},
                },
            },
            "device-2": {
                "name": "Control Module 1",
                "metrics": {
                    "pump_speed": {"value": 0, "type": "int", "unit": "%"},
                    "valve_position": {"value": 50, "type": "int", "unit": "%"},
                    "enabled": {"value": False, "type": "bool", "unit": ""},
                },
            },
        }
        self.metrics = {
            "uptime": {"value": 0, "type": "int", "unit": "s"},
            "status": {"value": "online", "type": "string", "unit": ""},
        }
        self.node_online = False
        self.timestamp = int(time.time() * 1000)

    def _next_sequence(self) -> int:
        """Get next sequence number (0-255)."""
        self.sequence = (self.sequence + 1) % 256
        return self.sequence

    def _encode_varint(self, value: int) -> bytes:
        """Encode a varint."""
        buf = bytearray()
        while (value & 0xffffff80) != 0:
            buf.append((value & 0xff) | 0x80)
            value >>= 7
        buf.append(value & 0xff)
        return bytes(buf)

    def _encode_metric_protobuf(self, name: str, value: any, metric_type: str) -> bytes:
        """Encode a single metric to protobuf."""
        parts = []
        # Field 1: name (string, wire type 2)
        name_bytes = name.encode("utf-8")
        parts.append(bytes([0x0a]))
        parts.append(self._encode_varint(len(name_bytes)))
        parts.append(name_bytes)
        
        # Field 2: timestamp (varint, wire type 0)
        parts.append(bytes([0x10]))
        parts.append(self._encode_varint(int(time.time() * 1000)))
        
        # Add value based on type
        metric_type = str(metric_type).lower()
        if metric_type in ("int", "int32"):
            # Field 5: int_value
            parts.append(bytes([0x28]))
            parts.append(self._encode_varint(int(value)))
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
            parts.append(self._encode_varint(len(val_bytes)))
            parts.append(val_bytes)
        
        return b"".join(parts)

    def _encode_payload_protobuf(self, metrics: List[tuple]) -> bytes:
        """Encode a Sparkplug B payload."""
        parts = []
        
        # Field 1: timestamp (varint)
        parts.append(bytes([0x08]))
        parts.append(self._encode_varint(int(time.time() * 1000)))
        
        # Field 2: metrics (repeated message)
        for name, value, dtype in metrics:
            metric_bytes = self._encode_metric_protobuf(name, value, dtype)
            parts.append(bytes([0x12]))
            parts.append(self._encode_varint(len(metric_bytes)))
            parts.append(metric_bytes)
        
        # Field 3: seq (varint)
        parts.append(bytes([0x18]))
        parts.append(self._encode_varint(self.sequence))
        
        return b"".join(parts)

    def _add_metric(
        self,
        metrics_list: List[tuple],
        name: str,
        value: any,
        metric_type: str,
    ) -> None:
        """Add a metric to the metrics list."""
        metrics_list.append((name, value, metric_type))

    def publish_node_birth(self) -> bool:
        """Publish NBIRTH (Node Birth) certificate."""
        self._next_sequence()
        metrics = []
        self._add_metric(metrics, "uptime", 0, "int")
        self._add_metric(metrics, "status", "online", "string")

        # Publish NBIRTH
        topic = f"spBv1.0/{self.group_id}/NBIRTH/{self.edge_node_id}"
        payload = self._encode_payload_protobuf(metrics)
        result = self.client.publish(topic, payload, qos=1, retain=False)
        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            self.node_online = True
            return True
        return False

    def publish_node_death(self) -> bool:
        """Publish NDEATH (Node Death) certificate."""
        self._next_sequence()
        metrics = []

        topic = f"spBv1.0/{self.group_id}/NDEATH/{self.edge_node_id}"
        payload = self._encode_payload_protobuf(metrics)
        result = self.client.publish(topic, payload, qos=1, retain=False)
        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            self.node_online = False
            return True
        return False

    def publish_device_birth(self, device_id: str) -> bool:
        """Publish DBIRTH (Device Birth) certificate."""
        if device_id not in self.devices:
            return False

        device = self.devices[device_id]
        self._next_sequence()
        metrics = []

        # Add device metrics with definitions
        for metric_name, metric_info in device["metrics"].items():
            self._add_metric(
                metrics, metric_name, metric_info["value"], metric_info["type"]
            )

        topic = f"spBv1.0/{self.group_id}/DBIRTH/{self.edge_node_id}/{device_id}"
        payload = self._encode_payload_protobuf(metrics)
        result = self.client.publish(topic, payload, qos=1, retain=False)
        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            return True
        return False

    def publish_device_death(self, device_id: str) -> bool:
        """Publish DDEATH (Device Death) certificate."""
        if device_id not in self.devices:
            return False

        self._next_sequence()
        metrics = []

        topic = f"spBv1.0/{self.group_id}/DDEATH/{self.edge_node_id}/{device_id}"
        payload = self._encode_payload_protobuf(metrics)
        result = self.client.publish(topic, payload, qos=1, retain=False)
        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            return True
        return False

    def publish_node_data(self) -> bool:
        """Publish NDATA (Node Data) with updated metrics."""
        if not self.node_online:
            return False

        self._next_sequence()
        metrics = []

        # Update and publish node metrics
        uptime = int((time.time() - self.start_time))
        self._add_metric(metrics, "uptime", uptime, "int")
        self._add_metric(metrics, "status", "online", "string")

        topic = f"spBv1.0/{self.group_id}/NDATA/{self.edge_node_id}"
        payload = self._encode_payload_protobuf(metrics)
        result = self.client.publish(topic, payload, qos=0, retain=False)
        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            return True
        return False

    def publish_device_data(self, device_id: str) -> bool:
        """Publish DDATA (Device Data) with updated metrics."""
        if device_id not in self.devices or not self.node_online:
            return False

        device = self.devices[device_id]
        self._next_sequence()
        metrics = []

        # Simulate metric changes
        if device_id == "device-1":
            # Sensor data with slight variations
            device["metrics"]["temperature"]["value"] = (
                22.5 + 2.0 * math.sin(time.time() / 10.0)
            )
            device["metrics"]["pressure"]["value"] = (
                101.3 + 1.0 * math.cos(time.time() / 15.0)
            )
            device["metrics"]["flow_rate"]["value"] = (
                45.2 + 5.0 * math.sin(time.time() / 8.0)
            )

        # Add metrics to payload
        for metric_name, metric_info in device["metrics"].items():
            self._add_metric(
                metrics, metric_name, metric_info["value"], metric_info["type"]
            )

        topic = f"spBv1.0/{self.group_id}/DDATA/{self.edge_node_id}/{device_id}"
        payload = self._encode_payload_protobuf(metrics)
        result = self.client.publish(topic, payload, qos=0, retain=False)
        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            return True
        return False


class MockMQTTServer:
    """Mock MQTT Server with Sparkplug B simulation."""

    def __init__(self):
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect
        # Enable automatic reconnection with exponential backoff
        self.client.reconnect_delay_set(min_delay=1, max_delay=32)
        self.sparkplug = SparkplugBSimulator(self.client)
        self.running = True
        self.last_update = 0
        self.connected = False

    def on_connect(self, client, userdata, flags, rc):
        """Called when the client connects to the broker."""
        if rc == 0:
            self.connected = True
            print(f"Connected to broker")
            self.sparkplug.start_time = time.time()
        else:
            self.connected = False
            print(f"Connection failed with code {rc}")

    def on_message(self, client, userdata, msg):
        """Called when a message is received."""
        pass  # Silently handle messages

    def on_disconnect(self, client, userdata, rc):
        """Called when the client disconnects."""
        self.connected = False
        if rc != 0:
            print(f"Unexpected disconnection: {rc} (will auto-reconnect)")
        # Don't print on normal disconnect - let auto-reconnect handle it

    def connect(self):
        """Connect to MQTT broker."""
        try:
            print(f"Connecting to MQTT broker at {BROKER_HOST}:{BROKER_PORT}...")
            self.client.connect(BROKER_HOST, BROKER_PORT, keepalive=60)
            self.client.loop_start()
            time.sleep(0.5)  # Give connection time to establish
            return True
        except Exception as e:
            print(f"Failed to connect: {e}")
            return False

    def publish_standard_topics(self):
        """Publish to standard MQTT topics for testing."""
        topics = {
            "sensors/temperature": {"value": 22.5, "unit": "°C"},
            "sensors/pressure": {"value": 101.3, "unit": "kPa"},
            "sensors/humidity": {"value": 55, "unit": "%"},
            "control/pump": {"status": "off", "speed": 0},
            "control/valve": {"position": 50, "status": "stable"},
            "system/status": {"uptime": int(time.time() - self.sparkplug.start_time)},
        }

        for topic, data in topics.items():
            payload = json.dumps(data)
            self.client.publish(topic, payload, qos=1)

    def update_loop(self):
        """Main update loop."""
        try:
            # Publish NBIRTH on startup
            self.sparkplug.publish_node_birth()
            time.sleep(1)

            # Publish device births
            for device_id in self.sparkplug.devices:
                self.sparkplug.publish_device_birth(device_id)
                time.sleep(0.5)

            # Main loop
            iteration = 0
            while self.running:
                current_time = time.time()

                # Publish standard topics every 2 seconds
                if current_time - self.last_update >= UPDATE_INTERVAL:
                    self.publish_standard_topics()
                    self.sparkplug.publish_node_data()

                    # Publish device data
                    for device_id in self.sparkplug.devices:
                        self.sparkplug.publish_device_data(device_id)

                    self.last_update = current_time
                    iteration += 1
                    print(f"Update cycle {iteration}")

                time.sleep(0.1)

        except KeyboardInterrupt:
            print("\nShutdown requested...")
        finally:
            self.shutdown()

    def shutdown(self):
        """Gracefully shutdown the server."""
        print("Shutting down...")
        self.running = False

        # Publish device deaths
        for device_id in self.sparkplug.devices:
            self.sparkplug.publish_device_death(device_id)
            time.sleep(0.5)

        # Publish node death
        self.sparkplug.publish_node_death()

        self.client.loop_stop()
        self.client.disconnect()
        time.sleep(1)
        print("Shutdown complete")


def main():
    """Main entry point."""
    print(f"MQTT Mock Server - Sparkplug B Simulation")
    print(f"Broker: {BROKER_HOST}:{BROKER_PORT}")
    print(f"Sparkplug Group: {SPARKPLUG_GROUP_ID}")
    print(f"Edge Node: {SPARKPLUG_EDGE_NODE_ID}")
    print()

    server = MockMQTTServer()

    def signal_handler(sig, frame):
        server.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    if server.connect():
        server.update_loop()
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()

