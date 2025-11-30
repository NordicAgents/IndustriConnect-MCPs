#!/usr/bin/env node

import { performance } from "node:perf_hooks";
import fs from "node:fs";

import bacnet from "node-bacnet";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";

dotenv.config();

type ToolResult = {
  success: boolean;
  data?: any;
  error?: string | null;
  meta?: Record<string, any>;
};

const TRUE_SET = new Set(["1", "true", "yes", "on"]);

interface EnvConfig {
  interface: string;
  port: number;
  deviceInstance: number;
  writesEnabled: boolean;
  objectMapFile?: string;
}

function boolFromEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return TRUE_SET.has(value.trim().toLowerCase());
}

function loadEnv(): EnvConfig {
  return {
    interface: process.env.BACNET_INTERFACE || "0.0.0.0",
    port: parseInt(process.env.BACNET_PORT || "47808", 10),
    deviceInstance: parseInt(process.env.BACNET_DEVICE_INSTANCE || "1234", 10),
    writesEnabled: boolFromEnv(process.env.BACNET_WRITES_ENABLED, true),
    objectMapFile: process.env.OBJECT_MAP_FILE,
  };
}

class ObjectMap {
  private cache: Record<string, any> = {};
  private mtime?: number;

  constructor(private readonly path?: string) {
    this.load();
  }

  private load(): void {
    if (!this.path) {
      this.cache = {};
      this.mtime = undefined;
      return;
    }
    try {
      const stat = fs.statSync(this.path);
      if (this.mtime && this.mtime >= stat.mtimeMs) return;
      const raw = fs.readFileSync(this.path, "utf-8");
      const data = JSON.parse(raw);
      if (typeof data === "object" && data) {
        this.cache = data as Record<string, any>;
        this.mtime = stat.mtimeMs;
      }
    } catch {
      this.cache = {};
      this.mtime = undefined;
    }
  }

  get(alias: string): any | undefined {
    this.load();
    return this.cache[alias];
  }

  list(): Array<Record<string, any>> {
    this.load();
    return Object.entries(this.cache).map(([alias, spec]) => ({
      alias,
      device: (spec as any)?.device,
      object_type: (spec as any)?.object_type,
      object_instance: (spec as any)?.object_instance,
      description: (spec as any)?.description,
    }));
  }

  count(): number {
    this.load();
    return Object.keys(this.cache).length;
  }
}

class BACnetClientWrapper {
  private client: bacnet;

  constructor(private readonly config: EnvConfig) {
    this.client = new bacnet({
      apduTimeout: 6000,
      port: config.port,
    });
  }

  async discoverDevices(timeoutMs: number): Promise<{ devices: any[]; meta: Record<string, any> }> {
    const start = performance.now();
    // Placeholder: real code would send Who-Is and listen for I-Am.
    const devices = [
      { device_id: 12345, vendor: "SampleVendor", model: "MockController", description: "Sample BACnet device" },
    ];
    const durationMs = Number((performance.now() - start).toFixed(3));
    return { devices, meta: { duration_ms: durationMs, count: devices.length } };
  }

  async readProperty(deviceId: number, objectType: string, objectInstance: number, propertyId: string): Promise<{ value: any; meta: Record<string, any> }> {
    const start = performance.now();
    const value = 72.5; // placeholder measurement
    const durationMs = Number((performance.now() - start).toFixed(3));
    return { value, meta: { duration_ms: durationMs, device_id: deviceId } };
  }

  async writeProperty(deviceId: number, objectType: string, objectInstance: number, propertyId: string, value: any, priority?: number): Promise<Record<string, any>> {
    if (!this.config.writesEnabled) throw new Error("Write operations are disabled by configuration");
    const start = performance.now();
    const durationMs = Number((performance.now() - start).toFixed(3));
    return { duration_ms: durationMs, device_id: deviceId, priority };
  }

  connectionMeta(): Record<string, any> {
    return {
      interface: this.config.interface,
      port: this.config.port,
      device_instance: this.config.deviceInstance,
      writes_enabled: this.config.writesEnabled,
    };
  }
}

function makeResult(success: boolean, data?: any, error?: string | null, meta: Record<string, any> = {}): ToolResult {
  return { success, data, error: error ?? null, meta };
}

class BACnetMCPServer {
  private readonly server = new Server({ name: "BACnet MCP (Node)" });
  private readonly master: BACnetClientWrapper;
  private readonly objectMap: ObjectMap;

  constructor(private readonly config: EnvConfig) {
    this.master = new BACnetClientWrapper(config);
    this.objectMap = new ObjectMap(config.objectMapFile);

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        { name: "discover_devices", description: "Broadcast Who-Is and collect I-Am responses.", inputSchema: { type: "object", properties: { timeout_ms: { type: "integer" } } } },
        { name: "read_property", description: "Read a BACnet object property.", inputSchema: { type: "object", properties: { device_id: { type: "integer" }, object_type: { type: "string" }, object_instance: { type: "integer" }, property_id: { type: "string" } }, required: ["device_id", "object_type", "object_instance", "property_id"] } },
        { name: "write_property", description: "Write a BACnet object property.", inputSchema: { type: "object", properties: { device_id: { type: "integer" }, object_type: { type: "string" }, object_instance: { type: "integer" }, property_id: { type: "string" }, value: {}, priority: { type: "integer" } }, required: ["device_id", "object_type", "object_instance", "property_id", "value"] } },
        { name: "list_objects", description: "List object aliases from local map.", inputSchema: { type: "object", properties: {} } },
        { name: "read_object_by_alias", description: "Read property via object alias.", inputSchema: { type: "object", properties: { alias: { type: "string" } }, required: ["alias"] } },
        { name: "write_object_by_alias", description: "Write property via object alias.", inputSchema: { type: "object", properties: { alias: { type: "string" }, value: {} }, required: ["alias", "value"] } },
        { name: "ping", description: "Return BACnet MCP health/config.", inputSchema: { type: "object", properties: {} } },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const name = request.params.name;
      const args = request.params.arguments || {};
      switch (name) {
        case "discover_devices":
          return this.wrap(await this.handleDiscover(args));
        case "read_property":
          return this.wrap(await this.handleReadProperty(args));
        case "write_property":
          return this.wrap(await this.handleWriteProperty(args));
        case "list_objects":
          return this.wrap(makeResult(true, { objects: this.objectMap.list(), count: this.objectMap.count() }));
        case "read_object_by_alias":
          return this.wrap(await this.handleReadAlias(args));
        case "write_object_by_alias":
          return this.wrap(await this.handleWriteAlias(args));
        case "ping":
          return this.wrap(makeResult(true, {
            connection: this.master.connectionMeta(),
            writes_enabled: this.config.writesEnabled,
            object_aliases: this.objectMap.count(),
          }));
        default:
          return this.wrap(makeResult(false, undefined, `Unknown tool: ${name}`));
      }
    });
  }

  private wrap(result: ToolResult) {
    return { content: [{ type: "application/json", data: result }] };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("BACnet MCP (Node) listening on stdio");
  }

  private async handleDiscover(args: any): Promise<ToolResult> {
    const timeout = Number(args?.timeout_ms || 5000);
    try {
      const { devices, meta } = await this.master.discoverDevices(timeout);
      return makeResult(true, { devices }, null, meta);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err));
    }
  }

  private async handleReadProperty(args: any): Promise<ToolResult> {
    const deviceId = Number(args?.device_id || 0);
    const objectType = String(args?.object_type || "");
    const objectInstance = Number(args?.object_instance || 0);
    const propertyId = String(args?.property_id || "");
    try {
      const { value, meta } = await this.master.readProperty(deviceId, objectType, objectInstance, propertyId);
      return makeResult(true, { device: deviceId, object_type: objectType, object_instance: objectInstance, property_id: propertyId, value }, null, meta);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { device_id: deviceId });
    }
  }

  private async handleWriteProperty(args: any): Promise<ToolResult> {
    if (!this.config.writesEnabled) return makeResult(false, undefined, "Write operations are disabled by configuration");
    const deviceId = Number(args?.device_id || 0);
    const objectType = String(args?.object_type || "");
    const objectInstance = Number(args?.object_instance || 0);
    const propertyId = String(args?.property_id || "");
    const priority = args?.priority !== undefined ? Number(args.priority) : undefined;
    try {
      const meta = await this.master.writeProperty(deviceId, objectType, objectInstance, propertyId, args?.value, priority);
      return makeResult(true, { device: deviceId, object_type: objectType, object_instance: objectInstance, property_id: propertyId, value: args?.value, priority }, null, meta);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { device_id: deviceId });
    }
  }

  private async handleReadAlias(args: any): Promise<ToolResult> {
    const alias = String(args?.alias || "");
    const spec = this.objectMap.get(alias);
    if (!spec) return makeResult(false, undefined, `Unknown alias '${alias}'`);
    return this.handleReadProperty({
      device_id: spec.device,
      object_type: spec.object_type,
      object_instance: spec.object_instance,
      property_id: spec.property_id || "present-value",
    });
  }

  private async handleWriteAlias(args: any): Promise<ToolResult> {
    if (!this.config.writesEnabled) return makeResult(false, undefined, "Write operations are disabled by configuration");
    const alias = String(args?.alias || "");
    const spec = this.objectMap.get(alias);
    if (!spec) return makeResult(false, undefined, `Unknown alias '${alias}'`);
    return this.handleWriteProperty({
      device_id: spec.device,
      object_type: spec.object_type,
      object_instance: spec.object_instance,
      property_id: spec.property_id || "present-value",
      value: args?.value,
      priority: spec.priority,
    });
  }
}

const config = loadEnv();
const server = new BACnetMCPServer(config);

server.run().catch((err) => {
  console.error(err);
  process.exit(1);
});
