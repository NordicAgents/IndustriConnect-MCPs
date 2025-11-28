#!/usr/bin/env node

import { performance } from "node:perf_hooks";
import fs from "node:fs";

import net from "node:net";
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
  host: string;
  port: number;
  protocolType: string;
  writesEnabled: boolean;
  deviceMapFile?: string;
}

function boolFromEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return TRUE_SET.has(value.trim().toLowerCase());
}

function loadEnv(): EnvConfig {
  return {
    host: process.env.MC_HOST || "192.168.1.10",
    port: parseInt(process.env.MC_PORT || "5007", 10),
    protocolType: process.env.MC_PROTOCOL_TYPE || "3E",
    writesEnabled: boolFromEnv(process.env.MC_WRITES_ENABLED, true),
    deviceMapFile: process.env.DEVICE_MAP_FILE,
  };
}

class DeviceMap {
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
      device_type: (spec as any)?.device_type,
      address: (spec as any)?.address,
      description: (spec as any)?.description,
    }));
  }

  count(): number {
    this.load();
    return Object.keys(this.cache).length;
  }
}

class MCClientWrapper {
  constructor(private readonly config: EnvConfig) {}

  async readDevices(deviceType: string, startAddress: number, count: number): Promise<{ values: number[]; meta: Record<string, any> }> {
    const start = performance.now();
    // Placeholder: connect/send MC frame; for now synthesise data
    const values = Array.from({ length: count }, (_, i) => startAddress + i);
    const durationMs = Number((performance.now() - start).toFixed(3));
    return { values, meta: { duration_ms: durationMs, device_type: deviceType } };
  }

  async writeDevices(deviceType: string, startAddress: number, values: number[]): Promise<Record<string, any>> {
    if (!this.config.writesEnabled) throw new Error("Write operations are disabled by configuration");
    const start = performance.now();
    const durationMs = Number((performance.now() - start).toFixed(3));
    return { duration_ms: durationMs, device_type: deviceType, written: values.length };
  }

  connectionMeta(): Record<string, any> {
    return {
      host: this.config.host,
      port: this.config.port,
      protocol_type: this.config.protocolType,
      writes_enabled: this.config.writesEnabled,
    };
  }
}

function makeResult(success: boolean, data?: any, error?: string | null, meta: Record<string, any> = {}): ToolResult {
  return { success, data, error: error ?? null, meta };
}

class MELSECMCPServer {
  private readonly server = new Server({ name: "MELSEC MC MCP (Node)" });
  private readonly client: MCClientWrapper;
  private readonly deviceMap: DeviceMap;

  constructor(private readonly config: EnvConfig) {
    this.client = new MCClientWrapper(config);
    this.deviceMap = new DeviceMap(config.deviceMapFile);

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        { name: "read_devices", description: "Batch read MC devices.", inputSchema: { type: "object", properties: { device_type: { type: "string" }, start_address: { type: "integer" }, count: { type: "integer" } }, required: ["device_type", "start_address", "count"] } },
        { name: "write_devices", description: "Batch write MC devices.", inputSchema: { type: "object", properties: { device_type: { type: "string" }, start_address: { type: "integer" }, values: { type: "array", items: { type: "integer" } } }, required: ["device_type", "start_address", "values"] } },
        { name: "list_devices", description: "List mapped device aliases.", inputSchema: { type: "object", properties: {} } },
        { name: "read_device_by_alias", description: "Read via alias.", inputSchema: { type: "object", properties: { alias: { type: "string" } }, required: ["alias"] } },
        { name: "write_device_by_alias", description: "Write via alias.", inputSchema: { type: "object", properties: { alias: { type: "string" }, values: { type: "array", items: { type: "integer" } } }, required: ["alias", "values"] } },
        { name: "ping", description: "Return connection status.", inputSchema: { type: "object", properties: {} } },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const tool = request.params.name;
      const args = request.params.arguments || {};
      switch (tool) {
        case "read_devices":
          return this.wrap(await this.handleReadDevices(args));
        case "write_devices":
          return this.wrap(await this.handleWriteDevices(args));
        case "list_devices":
          return this.wrap(makeResult(true, { devices: this.deviceMap.list(), count: this.deviceMap.count() }));
        case "read_device_by_alias":
          return this.wrap(await this.handleReadAlias(args));
        case "write_device_by_alias":
          return this.wrap(await this.handleWriteAlias(args));
        case "ping":
          return this.wrap(makeResult(true, {
            connection: this.client.connectionMeta(),
            writes_enabled: this.config.writesEnabled,
            device_aliases: this.deviceMap.count(),
          }));
        default:
          return this.wrap(makeResult(false, undefined, `Unknown tool: ${tool}`));
      }
    });
  }

  private wrap(result: ToolResult) {
    return { content: [{ type: "application/json", data: result }] };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("MELSEC MC MCP (Node) listening on stdio");
  }

  private async handleReadDevices(args: any): Promise<ToolResult> {
    const deviceType = String(args?.device_type || "");
    const startAddress = Number(args?.start_address || 0);
    const count = Number(args?.count || 1);
    try {
      const { values, meta } = await this.client.readDevices(deviceType, startAddress, count);
      return makeResult(true, { device_type: deviceType, start_address: startAddress, values }, null, meta);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { device_type: deviceType });
    }
  }

  private async handleWriteDevices(args: any): Promise<ToolResult> {
    if (!this.config.writesEnabled) return makeResult(false, undefined, "Write operations are disabled by configuration");
    const deviceType = String(args?.device_type || "");
    const startAddress = Number(args?.start_address || 0);
    const values = Array.isArray(args?.values) ? args.values.map((v: any) => Number(v)) : [];
    try {
      const meta = await this.client.writeDevices(deviceType, startAddress, values);
      return makeResult(true, { device_type: deviceType, start_address: startAddress, written: values.length }, null, meta);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { device_type: deviceType });
    }
  }

  private async handleReadAlias(args: any): Promise<ToolResult> {
    const alias = String(args?.alias || "");
    const spec = this.deviceMap.get(alias);
    if (!spec) return makeResult(false, undefined, `Unknown alias '${alias}'`);
    return this.handleReadDevices({
      device_type: spec.device_type,
      start_address: spec.address,
      count: spec.word_count ?? spec.bit_count ?? 1,
    });
  }

  private async handleWriteAlias(args: any): Promise<ToolResult> {
    if (!this.config.writesEnabled) return makeResult(false, undefined, "Write operations are disabled by configuration");
    const alias = String(args?.alias || "");
    const spec = this.deviceMap.get(alias);
    if (!spec) return makeResult(false, undefined, `Unknown alias '${alias}'`);
    return this.handleWriteDevices({
      device_type: spec.device_type,
      start_address: spec.address,
      values: args?.values ?? [],
    });
  }
}

const config = loadEnv();
const server = new MELSECMCPServer(config);

server.run().catch((err) => {
  console.error(err);
  process.exit(1);
});
