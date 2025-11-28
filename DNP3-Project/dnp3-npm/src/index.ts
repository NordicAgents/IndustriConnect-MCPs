#!/usr/bin/env node

import { performance } from "node:perf_hooks";
import fs from "node:fs";

import { SerialPort } from "serialport";
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
  connectionType: "tcp" | "serial";
  host: string;
  port: number;
  serialPort: string;
  writesEnabled: boolean;
  pointMapFile?: string;
}

function boolFromEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return TRUE_SET.has(value.trim().toLowerCase());
}

function loadEnv(): EnvConfig {
  return {
    connectionType: (process.env.DNP3_CONNECTION_TYPE || "tcp").toLowerCase() as "tcp" | "serial",
    host: process.env.DNP3_HOST || "127.0.0.1",
    port: parseInt(process.env.DNP3_PORT || "20000", 10),
    serialPort: process.env.DNP3_SERIAL_PORT || "/dev/ttyUSB0",
    writesEnabled: boolFromEnv(process.env.DNP3_WRITES_ENABLED, true),
    pointMapFile: process.env.POINT_MAP_FILE,
  };
}

class PointMap {
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
      outstation: (spec as any)?.outstation,
      type: (spec as any)?.type,
      index: (spec as any)?.index,
      description: (spec as any)?.description,
    }));
  }

  count(): number {
    this.load();
    return Object.keys(this.cache).length;
  }
}

class DNP3MasterWrapper {
  private tcpConnected = false;
  private serial?: SerialPort;

  constructor(private readonly config: EnvConfig) {}

  async ensureOpen(): Promise<void> {
    if (this.config.connectionType === "serial" && !this.serial) {
      this.serial = new SerialPort({
        path: this.config.serialPort,
        baudRate: 9600,
        autoOpen: false,
      });
      await new Promise<void>((resolve, reject) => {
        this.serial!.open((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } else if (this.config.connectionType === "tcp" && !this.tcpConnected) {
      // Placeholder: real OpenDNP3 bindings would create a channel here.
      this.tcpConnected = true;
    }
  }

  async readBinaryInputs(outstation: number, start: number, count: number): Promise<{ points: any[]; meta: Record<string, any> }> {
    await this.ensureOpen();
    const startTime = performance.now();
    const points = Array.from({ length: count }, (_, i) => ({
      index: start + i,
      value: ((start + i) % 2) === 0,
      quality: "ONLINE",
      timestamp: new Date().toISOString(),
    }));
    const durationMs = Number((performance.now() - startTime).toFixed(3));
    return { points, meta: { duration_ms: durationMs, outstation } };
  }

  async readAnalogInputs(outstation: number, start: number, count: number): Promise<{ points: any[]; meta: Record<string, any> }> {
    await this.ensureOpen();
    const startTime = performance.now();
    const points = Array.from({ length: count }, (_, i) => ({
      index: start + i,
      value: start + i + 0.5,
      quality: "ONLINE",
      timestamp: new Date().toISOString(),
    }));
    const durationMs = Number((performance.now() - startTime).toFixed(3));
    return { points, meta: { duration_ms: durationMs, outstation } };
  }

  async writeBinaryOutput(outstation: number, index: number, value: boolean): Promise<Record<string, any>> {
    if (!this.config.writesEnabled) throw new Error("Write operations are disabled by configuration");
    await this.ensureOpen();
    const startTime = performance.now();
    const durationMs = Number((performance.now() - startTime).toFixed(3));
    return { duration_ms: durationMs, outstation, index, value };
  }

  async pollClass(outstation: number, klass: number): Promise<Record<string, any>> {
    await this.ensureOpen();
    const startTime = performance.now();
    const durationMs = Number((performance.now() - startTime).toFixed(3));
    return { duration_ms: durationMs, outstation, class: klass };
  }

  connectionMeta(): Record<string, any> {
    return {
      connection_type: this.config.connectionType,
      host: this.config.host,
      port: this.config.port,
      serial_port: this.config.serialPort,
      writes_enabled: this.config.writesEnabled,
    };
  }
}

function makeResult(success: boolean, data?: any, error?: string | null, meta: Record<string, any> = {}): ToolResult {
  return { success, data, error: error ?? null, meta };
}

class DNP3MCPServer {
  private readonly server = new Server({ name: "DNP3 MCP (Node)" });
  private readonly master: DNP3MasterWrapper;
  private readonly pointMap: PointMap;

  constructor(private readonly config: EnvConfig) {
    this.master = new DNP3MasterWrapper(config);
    this.pointMap = new PointMap(config.pointMapFile);

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        { name: "read_binary_inputs", description: "Read binary input points.", inputSchema: { type: "object", properties: { outstation_address: { type: "integer" }, start_index: { type: "integer" }, count: { type: "integer" } }, required: ["outstation_address", "start_index", "count"] } },
        { name: "read_analog_inputs", description: "Read analog input points.", inputSchema: { type: "object", properties: { outstation_address: { type: "integer" }, start_index: { type: "integer" }, count: { type: "integer" } }, required: ["outstation_address", "start_index", "count"] } },
        { name: "write_binary_output", description: "Operate a binary output.", inputSchema: { type: "object", properties: { outstation_address: { type: "integer" }, index: { type: "integer" }, value: { type: "boolean" } }, required: ["outstation_address", "index", "value"] } },
        { name: "poll_class", description: "Poll a DNP3 event class (0-3).", inputSchema: { type: "object", properties: { outstation_address: { type: "integer" }, event_class: { type: "integer" } }, required: ["outstation_address", "event_class"] } },
        { name: "list_points", description: "List configured point aliases.", inputSchema: { type: "object", properties: {} } },
        { name: "read_point_by_alias", description: "Read by alias entry.", inputSchema: { type: "object", properties: { alias: { type: "string" } }, required: ["alias"] } },
        { name: "write_point_by_alias", description: "Write by alias entry.", inputSchema: { type: "object", properties: { alias: { type: "string" }, value: {} }, required: ["alias", "value"] } },
        { name: "ping", description: "Return health/config info.", inputSchema: { type: "object", properties: {} } },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const name = request.params.name;
      const args = request.params.arguments || {};
      switch (name) {
        case "read_binary_inputs":
          return this.wrap(await this.handleReadBinaryInputs(args));
        case "read_analog_inputs":
          return this.wrap(await this.handleReadAnalogInputs(args));
        case "write_binary_output":
          return this.wrap(await this.handleWriteBinaryOutput(args));
        case "poll_class":
          return this.wrap(await this.handlePollClass(args));
        case "list_points":
          return this.wrap(makeResult(true, { points: this.pointMap.list(), count: this.pointMap.count() }));
        case "read_point_by_alias":
          return this.wrap(await this.handleReadAlias(args));
        case "write_point_by_alias":
          return this.wrap(await this.handleWriteAlias(args));
        case "ping":
          return this.wrap(makeResult(true, {
            connection: this.master.connectionMeta(),
            writes_enabled: this.config.writesEnabled,
            point_aliases: this.pointMap.count(),
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
    await this.master.ensureOpen().catch(() => {
      // allow lazy connection
    });
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("DNP3 MCP (Node) listening on stdio");
  }

  private async handleReadBinaryInputs(args: any): Promise<ToolResult> {
    const addr = Number(args?.outstation_address || 0);
    const start = Number(args?.start_index || 0);
    const count = Number(args?.count || 1);
    try {
      const { points, meta } = await this.master.readBinaryInputs(addr, start, count);
      return makeResult(true, { outstation: addr, points }, null, meta);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { outstation_address: addr });
    }
  }

  private async handleReadAnalogInputs(args: any): Promise<ToolResult> {
    const addr = Number(args?.outstation_address || 0);
    const start = Number(args?.start_index || 0);
    const count = Number(args?.count || 1);
    try {
      const { points, meta } = await this.master.readAnalogInputs(addr, start, count);
      return makeResult(true, { outstation: addr, points }, null, meta);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { outstation_address: addr });
    }
  }

  private async handleWriteBinaryOutput(args: any): Promise<ToolResult> {
    if (!this.config.writesEnabled) return makeResult(false, undefined, "Write operations are disabled by configuration");
    const addr = Number(args?.outstation_address || 0);
    const index = Number(args?.index || 0);
    const value = Boolean(args?.value);
    try {
      const meta = await this.master.writeBinaryOutput(addr, index, value);
      return makeResult(true, { outstation: addr, index, value }, null, meta);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { outstation_address: addr });
    }
  }

  private async handlePollClass(args: any): Promise<ToolResult> {
    const addr = Number(args?.outstation_address || 0);
    const klass = Number(args?.event_class || 1);
    try {
      const meta = await this.master.pollClass(addr, klass);
      return makeResult(true, { outstation: addr, class: klass }, null, meta);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { outstation_address: addr });
    }
  }

  private async handleReadAlias(args: any): Promise<ToolResult> {
    const alias = String(args?.alias || "");
    const spec = this.pointMap.get(alias);
    if (!spec) return makeResult(false, undefined, `Unknown alias '${alias}'`);
    const outstation = Number(spec.outstation || 0);
    const index = Number(spec.index || 0);
    const pType = String(spec.type || "");
    if (pType === "binary_input") {
      return this.handleReadBinaryInputs({ outstation_address: outstation, start_index: index, count: 1 });
    }
    if (pType === "analog_input") {
      return this.handleReadAnalogInputs({ outstation_address: outstation, start_index: index, count: 1 });
    }
    return makeResult(false, undefined, `Point type '${pType}' is not readable via alias`);
  }

  private async handleWriteAlias(args: any): Promise<ToolResult> {
    if (!this.config.writesEnabled) return makeResult(false, undefined, "Write operations are disabled by configuration");
    const alias = String(args?.alias || "");
    const spec = this.pointMap.get(alias);
    if (!spec) return makeResult(false, undefined, `Unknown alias '${alias}'`);
    const outstation = Number(spec.outstation || 0);
    const index = Number(spec.index || 0);
    const pType = String(spec.type || "");
    if (pType === "binary_output") {
      return this.handleWriteBinaryOutput({ outstation_address: outstation, index, value: args?.value ?? false });
    }
    return makeResult(false, undefined, `Point type '${pType}' is not writable via alias`);
  }
}

const config = loadEnv();
const server = new DNP3MCPServer(config);

server.run().catch((err) => {
  console.error(err);
  process.exit(1);
});
