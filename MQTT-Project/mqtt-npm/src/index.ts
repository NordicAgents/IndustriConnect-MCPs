#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import * as mqtt from "mqtt";

// Configuration from environment
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://127.0.0.1:1883";
const MQTT_CLIENT_ID = process.env.MQTT_CLIENT_ID || "mqtt-mcp-client";
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const MQTT_KEEPALIVE = parseInt(process.env.MQTT_KEEPALIVE || "60");
const SPARKPLUG_GROUP_ID = process.env.SPARKPLUG_GROUP_ID || "factory";
const SPARKPLUG_EDGE_NODE_ID = process.env.SPARKPLUG_EDGE_NODE_ID || "edge-node-1";

// State management
let client: mqtt.MqttClient | null = null;
let connected = false;
const subscriptions = new Set<string>();
const sparkplugSequence: Record<string, number> = {};
const birthCertificates: Record<string, any> = {};

type ToolResult = {
  success: boolean;
  data?: any;
  error?: string | null;
  meta?: Record<string, any>;
};

function makeResult(
  success: boolean,
  data?: any,
  error?: string | null,
  meta?: Record<string, any>
): ToolResult {
  return { success, data, error: error ?? null, meta: meta || {} };
}

async function ensureConnection(): Promise<void> {
  if (connected && client) return;

  return new Promise((resolve, reject) => {
    const options: mqtt.IClientOptions = {
      clientId: MQTT_CLIENT_ID,
      keepalive: MQTT_KEEPALIVE,
      reconnectPeriod: 1000,
      clean: false,
    };

    if (MQTT_USERNAME && MQTT_PASSWORD) {
      options.username = MQTT_USERNAME;
      options.password = MQTT_PASSWORD;
    }

    client = mqtt.connect(MQTT_BROKER_URL, options);

    client.on("connect", () => {
      connected = true;
      resolve();
    });

    client.on("error", (error) => {
      // Don't reject on error - let auto-reconnect handle it
      connected = false;
    });

    client.on("message", (topic: string, message: Buffer) => {
      // Handle incoming messages silently
    });

    // Resolve immediately - connection will happen asynchronously
    // The MQTT client will auto-reconnect if needed
    setTimeout(() => {
      resolve();
    }, 500);
  });
}

function nextSequence(key: string): number {
  if (!sparkplugSequence[key]) {
    sparkplugSequence[key] = 0;
  }
  sparkplugSequence[key] = (sparkplugSequence[key] + 1) % 256;
  return sparkplugSequence[key];
}

// Simple Sparkplug B protobuf encoder
function encodeSparkplugPayload(
  timestamp: number,
  metrics: Array<{ name: string; value: any; type?: string }>,
  seq: number
): Buffer {
  // Create a minimal Sparkplug B protobuf payload
  // Format: [field_number << 3 | wire_type] [value]
  // This is a simplified implementation for basic testing
  const parts: Buffer[] = [];

  // Field 1: timestamp (varint)
  parts.push(Buffer.from([0x08])); // field 1, wire type 0 (varint)
  parts.push(encodeVarint(timestamp));

  // Field 2: metrics (repeated message)
  for (const metric of metrics) {
    const metricBytes = encodeMetric(metric);
    parts.push(Buffer.from([0x12])); // field 2, wire type 2 (length-delimited)
    parts.push(encodeVarint(metricBytes.length));
    parts.push(metricBytes);
  }

  // Field 3: seq (varint)
  parts.push(Buffer.from([0x18])); // field 3, wire type 0 (varint)
  parts.push(encodeVarint(seq));

  return Buffer.concat(parts);
}

function encodeMetric(metric: {
  name: string;
  value: any;
  type?: string;
}): Buffer {
  const parts: Buffer[] = [];

  // Field 1: name (string)
  const nameBytes = Buffer.from(metric.name, "utf-8");
  parts.push(Buffer.from([0x0a])); // field 1, wire type 2
  parts.push(encodeVarint(nameBytes.length));
  parts.push(nameBytes);

  // Field 2: timestamp (varint) - optional, use current
  parts.push(Buffer.from([0x10])); // field 2, wire type 0
  parts.push(encodeVarint(Date.now()));

  // Field 3-7: value fields based on type
  const type = String(metric.type || "string").toLowerCase();
  if (type === "int32" || type === "int") {
    parts.push(Buffer.from([0x28])); // field 5 (int_value), wire type 0
    parts.push(encodeVarint(parseInt(metric.value) || 0));
  } else if (type === "float") {
    parts.push(Buffer.from([0x4d])); // field 9 (float_value), wire type 5
    const buf = Buffer.alloc(4);
    buf.writeFloatBE(parseFloat(metric.value) || 0, 0);
    parts.push(buf);
  } else if (type === "boolean") {
    parts.push(Buffer.from([0x58])); // field 11 (boolean_value), wire type 0
    parts.push(Buffer.from([metric.value === true || metric.value === "true" ? 1 : 0]));
  } else {
    // string type
    const strBytes = Buffer.from(String(metric.value), "utf-8");
    parts.push(Buffer.from([0x62])); // field 12 (string_value), wire type 2
    parts.push(encodeVarint(strBytes.length));
    parts.push(strBytes);
  }

  return Buffer.concat(parts);
}

function encodeVarint(value: number): Buffer {
  const buf: number[] = [];
  while ((value & 0xffffff80) !== 0) {
    buf.push((value & 0xff) | 0x80);
    value >>>= 7;
  }
  buf.push(value & 0xff);
  return Buffer.from(buf);
}

async function publishMessage(
  topic: string,
  payload: string | Buffer,
  qos: 0 | 1 | 2 = 0,
  retain: boolean = false
): Promise<void> {
  await ensureConnection();
  return new Promise((resolve, reject) => {
    client!.publish(topic, payload, { qos, retain }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

class MQTTMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      { name: "mqtt-mcp-npx-server", version: "0.1.1" },
      { capabilities: { tools: {} } }
    );

    this.setupToolHandlers();
    this.setupLifecycle();
  }

  private setupLifecycle() {
    process.on("SIGINT", async () => {
      await this.shutdown();
      process.exit(0);
    });
    process.on("SIGTERM", async () => {
      await this.shutdown();
      process.exit(0);
    });
  }

  private async shutdown(): Promise<void> {
    if (client) {
      client.end();
      client = null;
      connected = false;
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // Standard MQTT tools
          {
            name: "publish_message",
            description: "Publish a message to an MQTT topic",
            inputSchema: {
              type: "object",
              properties: {
                topic: {
                  type: "string",
                  description: "MQTT topic name",
                },
                payload: {
                  type: "string",
                  description: "Message payload (string or JSON)",
                },
                qos: {
                  type: "number",
                  description: "QoS level (0, 1, or 2)",
                  enum: [0, 1, 2],
                  default: 0,
                },
                retain: {
                  type: "boolean",
                  description: "Retain message on broker",
                  default: false,
                },
              },
              required: ["topic", "payload"],
            },
          },
          {
            name: "subscribe_topic",
            description: "Subscribe to an MQTT topic pattern",
            inputSchema: {
              type: "object",
              properties: {
                topic: {
                  type: "string",
                  description: "Topic pattern (supports +/# wildcards)",
                },
                qos: {
                  type: "number",
                  description: "QoS level",
                  enum: [0, 1, 2],
                  default: 0,
                },
              },
              required: ["topic"],
            },
          },
          {
            name: "unsubscribe_topic",
            description: "Unsubscribe from an MQTT topic",
            inputSchema: {
              type: "object",
              properties: {
                topic: {
                  type: "string",
                  description: "Topic name to unsubscribe from",
                },
              },
              required: ["topic"],
            },
          },
          {
            name: "list_subscriptions",
            description: "List active MQTT subscriptions",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "get_broker_info",
            description: "Get MQTT broker connection info and status",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          // Sparkplug B tools
          {
            name: "publish_node_birth",
            description:
              "Publish Sparkplug B Node Birth (NBIRTH) certificate with metrics",
            inputSchema: {
              type: "object",
              properties: {
                metrics: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      value: { type: ["number", "string", "boolean"] },
                      type: {
                        type: "string",
                        enum: ["int32", "float", "boolean", "string"],
                      },
                    },
                    required: ["name", "value", "type"],
                  },
                  description: "Node metrics",
                },
              },
            },
          },
          {
            name: "publish_node_death",
            description: "Publish Sparkplug B Node Death (NDEATH) certificate",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "publish_device_birth",
            description:
              "Publish Sparkplug B Device Birth (DBIRTH) certificate",
            inputSchema: {
              type: "object",
              properties: {
                device_id: {
                  type: "string",
                  description: "Device ID",
                },
                metrics: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      value: { type: ["number", "string", "boolean"] },
                      type: {
                        type: "string",
                        enum: ["int32", "float", "boolean", "string"],
                      },
                    },
                    required: ["name", "value", "type"],
                  },
                  description: "Device metrics",
                },
              },
              required: ["device_id", "metrics"],
            },
          },
          {
            name: "publish_device_death",
            description:
              "Publish Sparkplug B Device Death (DDEATH) certificate",
            inputSchema: {
              type: "object",
              properties: {
                device_id: {
                  type: "string",
                  description: "Device ID",
                },
              },
              required: ["device_id"],
            },
          },
          {
            name: "publish_node_data",
            description: "Publish Sparkplug B Node Data (NDATA) update",
            inputSchema: {
              type: "object",
              properties: {
                metrics: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      value: { type: ["number", "string", "boolean"] },
                      type: {
                        type: "string",
                        enum: ["int32", "float", "boolean", "string"],
                      },
                    },
                    required: ["name", "value"],
                  },
                  description: "Updated metrics",
                },
              },
              required: ["metrics"],
            },
          },
          {
            name: "publish_device_data",
            description: "Publish Sparkplug B Device Data (DDATA) update",
            inputSchema: {
              type: "object",
              properties: {
                device_id: {
                  type: "string",
                  description: "Device ID",
                },
                metrics: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      value: { type: ["number", "string", "boolean"] },
                      type: {
                        type: "string",
                        enum: ["int32", "float", "boolean", "string"],
                      },
                    },
                    required: ["name", "value"],
                  },
                  description: "Updated metrics",
                },
              },
              required: ["device_id", "metrics"],
            },
          },
          {
            name: "publish_node_command",
            description: "Publish Sparkplug B Node Command (NCMD)",
            inputSchema: {
              type: "object",
              properties: {
                metrics: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      value: { type: ["number", "string", "boolean"] },
                      type: {
                        type: "string",
                        enum: ["int32", "float", "boolean", "string"],
                      },
                    },
                    required: ["name", "value"],
                  },
                  description: "Command metrics",
                },
              },
              required: ["metrics"],
            },
          },
          {
            name: "publish_device_command",
            description: "Publish Sparkplug B Device Command (DCMD)",
            inputSchema: {
              type: "object",
              properties: {
                device_id: {
                  type: "string",
                  description: "Device ID",
                },
                metrics: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      value: { type: ["number", "string", "boolean"] },
                      type: {
                        type: "string",
                        enum: ["int32", "float", "boolean", "string"],
                      },
                    },
                    required: ["name", "value"],
                  },
                  description: "Command metrics",
                },
              },
              required: ["device_id", "metrics"],
            },
          },
          {
            name: "list_sparkplug_nodes",
            description: "List discovered Sparkplug B nodes and devices",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "decode_sparkplug_payload",
            description: "Decode a Sparkplug B protobuf payload (hex encoded)",
            inputSchema: {
              type: "object",
              properties: {
                payload_hex: {
                  type: "string",
                  description: "Hex-encoded protobuf payload",
                },
              },
              required: ["payload_hex"],
            },
          },
        ] satisfies Tool[],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        await ensureConnection();

        switch (name) {
          case "publish_message":
            return await this.handlePublishMessage(args);
          case "subscribe_topic":
            return await this.handleSubscribeTopic(args);
          case "unsubscribe_topic":
            return await this.handleUnsubscribeTopic(args);
          case "list_subscriptions":
            return this.handleListSubscriptions();
          case "get_broker_info":
            return this.handleGetBrokerInfo();
          case "publish_node_birth":
            return await this.handlePublishNodeBirth(args);
          case "publish_node_death":
            return await this.handlePublishNodeDeath(args);
          case "publish_device_birth":
            return await this.handlePublishDeviceBirth(args);
          case "publish_device_death":
            return await this.handlePublishDeviceDeath(args);
          case "publish_node_data":
            return await this.handlePublishNodeData(args);
          case "publish_device_data":
            return await this.handlePublishDeviceData(args);
          case "publish_node_command":
            return await this.handlePublishNodeCommand(args);
          case "publish_device_command":
            return await this.handlePublishDeviceCommand(args);
          case "list_sparkplug_nodes":
            return this.handleListSparkplugNodes();
          case "decode_sparkplug_payload":
            return this.handleDecodeSparkplugPayload(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        return this.wrap(
          makeResult(false, undefined, error?.message || String(error))
        );
      }
    });
  }

  private wrap(result: ToolResult) {
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  // Standard MQTT handlers

  private async handlePublishMessage(args: any) {
    const topic = String(args?.topic);
    const payload = String(args?.payload);
    const qos = (args?.qos ?? 0) as 0 | 1 | 2;
    const retain = Boolean(args?.retain ?? false);

    if (!topic) {
      return this.wrap(makeResult(false, undefined, "Topic is required"));
    }

    try {
      await publishMessage(topic, payload, qos, retain);
      return this.wrap(
        makeResult(true, { published: true }, null, {
          topic,
          qos,
          retain,
          size: payload.length,
        })
      );
    } catch (error: any) {
      return this.wrap(makeResult(false, undefined, error?.message));
    }
  }

  private async handleSubscribeTopic(args: any) {
    const topic = String(args?.topic);
    const qos = (args?.qos ?? 0) as 0 | 1 | 2;

    if (!topic) {
      return this.wrap(makeResult(false, undefined, "Topic is required"));
    }

    try {
      await ensureConnection();
      client!.subscribe(topic, { qos }, (error) => {
        if (error) {
          console.error(`Subscribe error: ${error}`);
        }
      });
      subscriptions.add(topic);
      return this.wrap(
        makeResult(true, { subscribed: true }, null, { topic, qos })
      );
    } catch (error: any) {
      return this.wrap(makeResult(false, undefined, error?.message));
    }
  }

  private async handleUnsubscribeTopic(args: any) {
    const topic = String(args?.topic);

    if (!topic) {
      return this.wrap(makeResult(false, undefined, "Topic is required"));
    }

    try {
      await ensureConnection();
      client!.unsubscribe(topic, (error) => {
        if (error) {
          console.error(`Unsubscribe error: ${error}`);
        }
      });
      subscriptions.delete(topic);
      return this.wrap(
        makeResult(true, { unsubscribed: true }, null, { topic })
      );
    } catch (error: any) {
      return this.wrap(makeResult(false, undefined, error?.message));
    }
  }

  private handleListSubscriptions() {
    return this.wrap(
      makeResult(
        true,
        { subscriptions: Array.from(subscriptions) },
        null,
        { count: subscriptions.size }
      )
    );
  }

  private handleGetBrokerInfo() {
    return this.wrap(
      makeResult(
        true,
        {
          connected,
          broker_url: MQTT_BROKER_URL,
          client_id: MQTT_CLIENT_ID,
          keepalive: MQTT_KEEPALIVE,
          subscriptions: Array.from(subscriptions),
        },
        null,
        { subscription_count: subscriptions.size }
      )
    );
  }

  // Sparkplug B handlers


  private async handlePublishNodeBirth(args: any) {
    const metrics = args?.metrics || [];
    const key = `${SPARKPLUG_GROUP_ID}/${SPARKPLUG_EDGE_NODE_ID}`;

    try {
      const seq = nextSequence(key);
      const payload = encodeSparkplugPayload(Date.now(), metrics, seq);

      const topic = `spBv1.0/${SPARKPLUG_GROUP_ID}/NBIRTH/${SPARKPLUG_EDGE_NODE_ID}`;
      await publishMessage(topic, payload, 1, false);

      birthCertificates[key] = { type: "NBIRTH", timestamp: Date.now() };

      return this.wrap(
        makeResult(
          true,
          { published: true, message_type: "NBIRTH" },
          null,
          { topic, metrics_count: metrics.length }
        )
      );
    } catch (error: any) {
      return this.wrap(makeResult(false, undefined, error?.message));
    }
  }

  private async handlePublishNodeDeath(args: any) {
    const key = `${SPARKPLUG_GROUP_ID}/${SPARKPLUG_EDGE_NODE_ID}`;

    try {
      const seq = nextSequence(key);
      const payload = encodeSparkplugPayload(Date.now(), [], seq);

      const topic = `spBv1.0/${SPARKPLUG_GROUP_ID}/NDEATH/${SPARKPLUG_EDGE_NODE_ID}`;
      await publishMessage(topic, payload, 1, false);

      delete birthCertificates[key];

      return this.wrap(
        makeResult(
          true,
          { published: true, message_type: "NDEATH" },
          null,
          { topic }
        )
      );
    } catch (error: any) {
      return this.wrap(makeResult(false, undefined, error?.message));
    }
  }

  private async handlePublishDeviceBirth(args: any) {
    const device_id = String(args?.device_id);
    const metrics = args?.metrics || [];
    const key = `${SPARKPLUG_GROUP_ID}/${SPARKPLUG_EDGE_NODE_ID}/${device_id}`;

    if (!device_id) {
      return this.wrap(
        makeResult(false, undefined, "device_id is required")
      );
    }

    try {
      const seq = nextSequence(key);
      const payload = encodeSparkplugPayload(Date.now(), metrics, seq);

      const topic = `spBv1.0/${SPARKPLUG_GROUP_ID}/DBIRTH/${SPARKPLUG_EDGE_NODE_ID}/${device_id}`;
      await publishMessage(topic, payload, 1, false);

      birthCertificates[key] = {
        type: "DBIRTH",
        device_id,
        timestamp: Date.now(),
      };

      return this.wrap(
        makeResult(
          true,
          { published: true, message_type: "DBIRTH", device_id },
          null,
          { topic, metrics_count: metrics.length }
        )
      );
    } catch (error: any) {
      return this.wrap(makeResult(false, undefined, error?.message));
    }
  }

  private async handlePublishDeviceDeath(args: any) {
    const device_id = String(args?.device_id);
    const key = `${SPARKPLUG_GROUP_ID}/${SPARKPLUG_EDGE_NODE_ID}/${device_id}`;

    if (!device_id) {
      return this.wrap(
        makeResult(false, undefined, "device_id is required")
      );
    }

    try {
      const seq = nextSequence(key);
      const payload = encodeSparkplugPayload(Date.now(), [], seq);

      const topic = `spBv1.0/${SPARKPLUG_GROUP_ID}/DDEATH/${SPARKPLUG_EDGE_NODE_ID}/${device_id}`;
      await publishMessage(topic, payload, 1, false);

      delete birthCertificates[key];

      return this.wrap(
        makeResult(
          true,
          { published: true, message_type: "DDEATH", device_id },
          null,
          { topic }
        )
      );
    } catch (error: any) {
      return this.wrap(makeResult(false, undefined, error?.message));
    }
  }

  private async handlePublishNodeData(args: any) {
    const metrics = args?.metrics || [];
    const key = `${SPARKPLUG_GROUP_ID}/${SPARKPLUG_EDGE_NODE_ID}`;

    if (metrics.length === 0) {
      return this.wrap(
        makeResult(false, undefined, "At least one metric is required")
      );
    }

    try {
      const seq = nextSequence(key);
      const payload = encodeSparkplugPayload(Date.now(), metrics, seq);

      const topic = `spBv1.0/${SPARKPLUG_GROUP_ID}/NDATA/${SPARKPLUG_EDGE_NODE_ID}`;
      await publishMessage(topic, payload, 0, false);

      return this.wrap(
        makeResult(
          true,
          { published: true, message_type: "NDATA" },
          null,
          { topic, metrics_count: metrics.length }
        )
      );
    } catch (error: any) {
      return this.wrap(makeResult(false, undefined, error?.message));
    }
  }

  private async handlePublishDeviceData(args: any) {
    const device_id = String(args?.device_id);
    const metrics = args?.metrics || [];
    const key = `${SPARKPLUG_GROUP_ID}/${SPARKPLUG_EDGE_NODE_ID}/${device_id}`;

    if (!device_id) {
      return this.wrap(
        makeResult(false, undefined, "device_id is required")
      );
    }

    if (metrics.length === 0) {
      return this.wrap(
        makeResult(false, undefined, "At least one metric is required")
      );
    }

    try {
      const seq = nextSequence(key);
      const payload = encodeSparkplugPayload(Date.now(), metrics, seq);

      const topic = `spBv1.0/${SPARKPLUG_GROUP_ID}/DDATA/${SPARKPLUG_EDGE_NODE_ID}/${device_id}`;
      await publishMessage(topic, payload, 0, false);

      return this.wrap(
        makeResult(
          true,
          { published: true, message_type: "DDATA", device_id },
          null,
          { topic, metrics_count: metrics.length }
        )
      );
    } catch (error: any) {
      return this.wrap(makeResult(false, undefined, error?.message));
    }
  }

  private async handlePublishNodeCommand(args: any) {
    const metrics = args?.metrics || [];
    const key = `${SPARKPLUG_GROUP_ID}/${SPARKPLUG_EDGE_NODE_ID}`;

    if (metrics.length === 0) {
      return this.wrap(
        makeResult(false, undefined, "At least one metric is required")
      );
    }

    try {
      const seq = nextSequence(key);
      const payload = encodeSparkplugPayload(Date.now(), metrics, seq);

      const topic = `spBv1.0/${SPARKPLUG_GROUP_ID}/NCMD/${SPARKPLUG_EDGE_NODE_ID}`;
      await publishMessage(topic, payload, 0, false);

      return this.wrap(
        makeResult(
          true,
          { published: true, message_type: "NCMD" },
          null,
          { topic, metrics_count: metrics.length }
        )
      );
    } catch (error: any) {
      return this.wrap(makeResult(false, undefined, error?.message));
    }
  }

  private async handlePublishDeviceCommand(args: any) {
    const device_id = String(args?.device_id);
    const metrics = args?.metrics || [];
    const key = `${SPARKPLUG_GROUP_ID}/${SPARKPLUG_EDGE_NODE_ID}/${device_id}`;

    if (!device_id) {
      return this.wrap(
        makeResult(false, undefined, "device_id is required")
      );
    }

    if (metrics.length === 0) {
      return this.wrap(
        makeResult(false, undefined, "At least one metric is required")
      );
    }

    try {
      const seq = nextSequence(key);
      const payload = encodeSparkplugPayload(Date.now(), metrics, seq);

      const topic = `spBv1.0/${SPARKPLUG_GROUP_ID}/DCMD/${SPARKPLUG_EDGE_NODE_ID}/${device_id}`;
      await publishMessage(topic, payload, 0, false);

      return this.wrap(
        makeResult(
          true,
          { published: true, message_type: "DCMD", device_id },
          null,
          { topic, metrics_count: metrics.length }
        )
      );
    } catch (error: any) {
      return this.wrap(makeResult(false, undefined, error?.message));
    }
  }

  private handleListSparkplugNodes() {
    const nodes = [];
    for (const [key, cert] of Object.entries(birthCertificates)) {
      nodes.push({
        key,
        ...cert,
      });
    }

    return this.wrap(
      makeResult(
        true,
        { nodes },
        null,
        { total_nodes: nodes.length, group_id: SPARKPLUG_GROUP_ID }
      )
    );
  }

  private handleDecodeSparkplugPayload(args: any) {
    const payload_hex = String(args?.payload_hex);

    if (!payload_hex) {
      return this.wrap(
        makeResult(false, undefined, "payload_hex is required")
      );
    }

    try {
      const buffer = Buffer.from(payload_hex, "hex");
      // Simple decoder - just show buffer info
      return this.wrap(
        makeResult(
          true,
          {
            hex: payload_hex,
            bytes: buffer.length,
            note: "Use a Sparkplug B protobuf decoder library for full decoding",
          },
          null,
          { buffer_length: buffer.length }
        )
      );
    } catch (error: any) {
      return this.wrap(makeResult(false, undefined, error?.message));
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("MQTT MCP Server running on stdio");
  }
}

const server = new MQTTMCPServer();
server.run().catch((e) => {
  console.error(e);
  process.exit(1);
});

