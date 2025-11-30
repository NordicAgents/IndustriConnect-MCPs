#!/usr/bin/env node

import { performance } from "node:perf_hooks";
import fs from "node:fs";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import snap7 from "node-snap7";

dotenv.config();

type ToolResult = {
  success: boolean;
  data?: any;
  error?: string | null;
  meta?: Record<string, any>;
};

const DEFAULT_BOOL_TRUE = new Set(["1", "true", "t", "yes", "on"]);

function boolFromEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return DEFAULT_BOOL_TRUE.has(value.trim().toLowerCase());
}

interface EnvConfig {
  host: string;
  port: number;
  rack: number;
  slot: number;
  connectionType: string;
  timeout: number;
  maxRetries: number;
  retryBackoff: number;
  writesEnabled: boolean;
  systemCmdsEnabled: boolean;
  tagMapFile?: string;
}

function loadEnv(): EnvConfig {
  return {
    host: process.env.S7_HOST || "127.0.0.1",
    port: parseInt(process.env.S7_PORT || "102", 10),
    rack: parseInt(process.env.S7_RACK || "0", 10),
    slot: parseInt(process.env.S7_SLOT || "2", 10),
    connectionType: process.env.S7_CONNECTION_TYPE || "PG",
    timeout: parseFloat(process.env.S7_TIMEOUT || "5"),
    maxRetries: parseInt(process.env.S7_MAX_RETRIES || "3", 10),
    retryBackoff: parseFloat(process.env.S7_RETRY_BACKOFF_BASE || "0.5"),
    writesEnabled: boolFromEnv(process.env.S7_WRITES_ENABLED, true),
    systemCmdsEnabled: boolFromEnv(process.env.S7_SYSTEM_CMDS_ENABLED, false),
    tagMapFile: process.env.TAG_MAP_FILE,
  };
}

const { S7Client: Snap7Client, S7Area, S7WordLen } = snap7 as any;
const AREA_CODES: Record<string, number> = {
  db: S7Area?.DB ?? 0x84,
  input: S7Area?.PE ?? 0x81,
  output: S7Area?.PA ?? 0x82,
  marker: S7Area?.MK ?? 0x83,
};
const WORD_LEN_BYTE: number = S7WordLen?.Byte ?? 0x02;

type OperationMeta = { attempts: number; duration_ms: number };

class S7ClientWrapper {
  private client = new Snap7Client();
  private connected = false;

  constructor(private readonly config: EnvConfig) {}

  async ensureConnected(force = false): Promise<void> {
    if (this.connected && !force) return;
    await this.execute("connect", () => {
      this.client.ConnectTo(this.config.host, this.config.rack, this.config.slot);
      this.connected = true;
      return true;
    }, true);
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    try {
      this.client.Disconnect();
    } catch {
      // ignore
    } finally {
      this.connected = false;
    }
  }

  async readDB(dbNumber: number, start: number, size: number): Promise<{ buffer: Buffer; meta: OperationMeta }> {
    await this.ensureConnected();
    const buffer = Buffer.alloc(size);
    const { meta } = await this.execute(`db_read(db=${dbNumber},start=${start},size=${size})`, () => {
      this.client.DBRead(dbNumber, start, size, buffer);
      return null;
    });
    return { buffer, meta };
  }

  async writeDB(dbNumber: number, start: number, payload: Buffer): Promise<OperationMeta> {
    await this.ensureConnected();
    const { meta } = await this.execute(`db_write(db=${dbNumber},start=${start},size=${payload.length})`, () => {
      this.client.DBWrite(dbNumber, start, payload.length, payload);
      return null;
    });
    return meta;
  }

  async readArea(area: string, startByte: number, size: number, dbNumber = 0): Promise<{ buffer: Buffer; meta: OperationMeta }> {
    await this.ensureConnected();
    const areaCode = AREA_CODES[area.toLowerCase()];
    if (areaCode === undefined) throw new Error(`Unsupported area '${area}'`);
    const buffer = Buffer.alloc(size);
    const { meta } = await this.execute(`read_area(area=${area},start=${startByte},size=${size},db=${dbNumber})`, () => {
      this.client.ReadArea(areaCode, dbNumber, startByte, size, WORD_LEN_BYTE, buffer);
      return null;
    });
    return { buffer, meta };
  }

  async writeArea(area: string, startByte: number, payload: Buffer, dbNumber = 0): Promise<OperationMeta> {
    await this.ensureConnected();
    const areaCode = AREA_CODES[area.toLowerCase()];
    if (areaCode === undefined) throw new Error(`Unsupported area '${area}'`);
    const { meta } = await this.execute(`write_area(area=${area},start=${startByte},size=${payload.length},db=${dbNumber})`, () => {
      this.client.WriteArea(areaCode, dbNumber, startByte, payload.length, WORD_LEN_BYTE, payload);
      return null;
    });
    return meta;
  }

  async readPlcInfo(): Promise<{ info: Record<string, any>; meta: OperationMeta }> {
    await this.ensureConnected();
    const { value, meta } = await this.execute("read_plc_info", () => {
      const cpuInfo = this.client.GetCpuInfo();
      const orderCode = this.client.GetOrderCode();
      return {
        module_type: cpuInfo?.ModuleTypeName,
        serial_number: cpuInfo?.SerialNumber,
        as_name: cpuInfo?.ASName,
        copyright: cpuInfo?.Copyright,
        order_code: orderCode?.Code,
        version: orderCode?.Version,
      };
    });
    return { info: value, meta };
  }

  async readCpuState(): Promise<{ state: string; meta: OperationMeta }> {
    await this.ensureConnected();
    const { value, meta } = await this.execute("read_cpu_state", () => {
      const state = this.client.GetCpuState();
      return typeof state === "string" ? state : String(state);
    });
    return { state: value, meta };
  }

  async setCpuState(state: string): Promise<OperationMeta> {
    await this.ensureConnected();
    const normalized = state.trim().toUpperCase();
    const { meta } = await this.execute(`set_cpu_state(${normalized})`, () => {
      if (normalized === "RUN") {
        if (typeof this.client.PlcHotStart === "function") this.client.PlcHotStart();
        else this.client.PlcColdStart();
      } else if (normalized === "STOP") {
        this.client.PlcStop();
      } else {
        throw new Error("state must be RUN or STOP");
      }
      return null;
    });
    return meta;
  }

  async readSystemTime(): Promise<{ timestamp: string; meta: OperationMeta }> {
    await this.ensureConnected();
    const { value, meta } = await this.execute("read_system_time", () => {
      const dt = this.client.GetPlcDateTime();
      if (dt instanceof Date) return dt.toISOString();
      return new Date().toISOString();
    });
    return { timestamp: value, meta };
  }

  connectionMeta(): Record<string, any> {
    return {
      connected: this.connected,
      host: this.config.host,
      port: this.config.port,
      rack: this.config.rack,
      slot: this.config.slot,
      connection_type: this.config.connectionType,
    };
  }

  private async execute<T>(label: string, fn: () => T, skipEnsure = false): Promise<{ value: T; meta: OperationMeta }> {
    const start = performance.now();
    let attempt = 0;
    let lastErr: any;
    while (attempt <= this.config.maxRetries) {
      attempt += 1;
      try {
        if (!skipEnsure) {
          if (!this.connected) await this.ensureConnected(true);
        }
        const value = fn();
        const duration = Number((performance.now() - start).toFixed(3));
        return { value, meta: { attempts: attempt, duration_ms: duration } };
      } catch (err: any) {
        lastErr = err;
        this.connected = false;
        if (attempt > this.config.maxRetries) break;
        await new Promise((res) => setTimeout(res, Math.round(this.config.retryBackoff * Math.pow(2, attempt - 1) * 1000)));
      }
    }
    const errMsg = lastErr?.message || String(lastErr);
    throw new Error(`${label} failed after ${attempt} attempts: ${errMsg}`);
  }
}

class TagMap {
  private tags: Record<string, any> = {};
  private mtime: number | undefined;

  constructor(private readonly filePath?: string) {
    this.load();
  }

  private load(): void {
    if (!this.filePath) {
      this.tags = {};
      return;
    }
    try {
      const stat = fs.statSync(this.filePath);
      if (this.mtime && this.mtime >= stat.mtimeMs) return;
      const content = fs.readFileSync(this.filePath, "utf-8");
      const data = JSON.parse(content);
      if (typeof data === "object" && data) {
        this.tags = data as Record<string, any>;
        this.mtime = stat.mtimeMs;
      }
    } catch {
      this.tags = {};
    }
  }

  get(name: string): Record<string, any> | undefined {
    this.load();
    return this.tags[name];
  }

  list(): Array<{ name: string; area?: string; description?: string }> {
    this.load();
    return Object.entries(this.tags).map(([name, spec]) => ({
      name,
      area: (spec as any)?.area,
      description: (spec as any)?.description,
    }));
  }

  count(): number {
    this.load();
    return Object.keys(this.tags).length;
  }
}

function makeResult(success: boolean, data?: any, error?: string | null, meta?: Record<string, any>): ToolResult {
  return { success, data, error: error ?? null, meta: meta || {} };
}

function bufferToHex(buf: Buffer): string {
  return buf.toString("hex");
}

function normalizeArea(area: string | undefined): string {
  return String(area || "db").toLowerCase();
}

function normalizeDbSpec(args: any): { db: number; start: number; size: number } {
  const db = Number(args?.db_number ?? args?.db ?? 1);
  const start = Number(args?.start_offset ?? args?.offset ?? 0);
  const size = Number(args?.size ?? 1);
  return { db, start, size };
}

function rawPayloadFromValue(value: any): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) return Buffer.from(value.map((v) => Number(v) & 0xff));
  if (typeof value === "string") {
    const stripped = value.replace(/\s+/g, "");
    return Buffer.from(stripped, "hex");
  }
  throw new Error("Provide a hex string or array of byte values when data_type is omitted");
}

class S7CommMCPServer {
  private readonly server = new Server({ name: "S7comm MCP (Node)" });
  private readonly tools: Tool[];
  private readonly client: S7ClientWrapper;
  private readonly tagMap: TagMap;

  constructor(private readonly config: EnvConfig) {
    this.client = new S7ClientWrapper(config);
    this.tagMap = new TagMap(config.tagMapFile);
    this.tools = [
      {
        name: "read_db",
        description: "Read raw bytes from a Siemens data block (DB).",
        inputSchema: {
          type: "object",
          properties: {
            db_number: { type: "integer" },
            start_offset: { type: "integer" },
            size: { type: "integer" },
          },
          required: ["db_number", "start_offset", "size"],
        },
      },
      {
        name: "write_db",
        description: "Write raw bytes into a Siemens data block.",
        inputSchema: {
          type: "object",
          properties: {
            db_number: { type: "integer" },
            start_offset: { type: "integer" },
            value: {},
          },
          required: ["db_number", "start_offset", "value"],
        },
      },
      {
        name: "read_input",
        description: "Read bytes from the process input image (PI).",
        inputSchema: {
          type: "object",
          properties: {
            start_byte: { type: "integer" },
            size: { type: "integer" },
          },
          required: ["start_byte", "size"],
        },
      },
      {
        name: "read_output",
        description: "Read bytes from the process output image (PQ).",
        inputSchema: {
          type: "object",
          properties: {
            start_byte: { type: "integer" },
            size: { type: "integer" },
          },
          required: ["start_byte", "size"],
        },
      },
      {
        name: "write_output",
        description: "Write bytes into the process output image (PQ).",
        inputSchema: {
          type: "object",
          properties: {
            start_byte: { type: "integer" },
            value: {},
          },
          required: ["start_byte", "value"],
        },
      },
      {
        name: "read_marker",
        description: "Read bytes from marker memory (M).",
        inputSchema: {
          type: "object",
          properties: {
            start_byte: { type: "integer" },
            size: { type: "integer" },
          },
          required: ["start_byte", "size"],
        },
      },
      {
        name: "write_marker",
        description: "Write bytes into marker memory (M).",
        inputSchema: {
          type: "object",
          properties: {
            start_byte: { type: "integer" },
            value: {},
          },
          required: ["start_byte", "value"],
        },
      },
      {
        name: "read_plc_info",
        description: "Fetch PLC identification information.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "read_cpu_state",
        description: "Read current CPU state (RUN/STOP).",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "set_cpu_state",
        description: "Change CPU state (requires S7_SYSTEM_CMDS_ENABLED=true).",
        inputSchema: {
          type: "object",
          properties: { state: { type: "string", enum: ["RUN", "STOP"] } },
          required: ["state"],
        },
      },
      {
        name: "list_tags",
        description: "List configured tag map entries.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "read_tag",
        description: "Read a tag defined in the JSON tag map.",
        inputSchema: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
        },
      },
      {
        name: "write_tag",
        description: "Write a tag defined in the JSON tag map (requires writes enabled).",
        inputSchema: {
          type: "object",
          properties: { name: { type: "string" }, value: {} },
          required: ["name", "value"],
        },
      },
      {
        name: "ping",
        description: "Return health and configuration details.",
        inputSchema: { type: "object", properties: {} },
      },
    ];

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: this.tools }));
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const name = request.params.name;
      const args = request.params.arguments || {};
      switch (name) {
        case "read_db":
          return { content: [{ type: "application/json", data: await this.handleReadDb(args) }] };
        case "write_db":
          return { content: [{ type: "application/json", data: await this.handleWriteDb(args) }] };
        case "read_input":
          return { content: [{ type: "application/json", data: await this.handleReadArea("input", args) }] };
        case "read_output":
          return { content: [{ type: "application/json", data: await this.handleReadArea("output", args) }] };
        case "write_output":
          return { content: [{ type: "application/json", data: await this.handleWriteArea("output", args) }] };
        case "read_marker":
          return { content: [{ type: "application/json", data: await this.handleReadArea("marker", args) }] };
        case "write_marker":
          return { content: [{ type: "application/json", data: await this.handleWriteArea("marker", args) }] };
        case "read_plc_info":
          return { content: [{ type: "application/json", data: await this.handleReadPlcInfo() }] };
        case "read_cpu_state":
          return { content: [{ type: "application/json", data: await this.handleReadCpuState() }] };
        case "set_cpu_state":
          return { content: [{ type: "application/json", data: await this.handleSetCpuState(args) }] };
        case "list_tags":
          return { content: [{ type: "application/json", data: await this.handleListTags() }] };
        case "read_tag":
          return { content: [{ type: "application/json", data: await this.handleReadTag(args) }] };
        case "write_tag":
          return { content: [{ type: "application/json", data: await this.handleWriteTag(args) }] };
        case "ping":
          return { content: [{ type: "application/json", data: await this.handlePing() }] };
        default:
          return { content: [{ type: "application/json", data: makeResult(false, undefined, `Unknown tool: ${name}`) }] };
      }
    });
  }

  async run(): Promise<void> {
    await this.client.ensureConnected().catch(() => {
      // connection happens lazily per call, but attempt upfront to catch obvious failures
    });
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("S7comm MCP (Node) listening on stdio");
  }

  private async handleReadDb(args: any): Promise<ToolResult> {
    const { db, start, size } = normalizeDbSpec(args);
    try {
      const { buffer, meta } = await this.client.readDB(db, start, size);
      return makeResult(true, { raw_bytes_hex: bufferToHex(buffer) }, null, { ...meta, db_number: db, start_offset: start, size });
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { db_number: db, start_offset: start, size });
    }
  }

  private async handleWriteDb(args: any): Promise<ToolResult> {
    if (!this.config.writesEnabled) return makeResult(false, undefined, "Writes are disabled by configuration");
    const { db, start } = normalizeDbSpec(args);
    try {
      const payload = rawPayloadFromValue(args?.value);
      const meta = await this.client.writeDB(db, start, payload);
      return makeResult(true, { written_bytes: payload.length }, null, { ...meta, db_number: db, start_offset: start });
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { db_number: db, start_offset: start });
    }
  }

  private async handleReadArea(area: "input" | "output" | "marker", args: any): Promise<ToolResult> {
    const start = Number(args?.start_byte ?? 0);
    const size = Number(args?.size ?? 1);
    try {
      const { buffer, meta } = await this.client.readArea(area, start, size);
      return makeResult(true, { raw_bytes_hex: bufferToHex(buffer) }, null, { ...meta, area, start_byte: start });
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { area, start_byte: start, size });
    }
  }

  private async handleWriteArea(area: "output" | "marker", args: any): Promise<ToolResult> {
    if (!this.config.writesEnabled) return makeResult(false, undefined, "Writes are disabled by configuration");
    const start = Number(args?.start_byte ?? 0);
    try {
      const payload = rawPayloadFromValue(args?.value);
      const meta = await this.client.writeArea(area, start, payload);
      return makeResult(true, { written_bytes: payload.length }, null, { ...meta, area, start_byte: start });
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { area, start_byte: start });
    }
  }

  private async handleReadPlcInfo(): Promise<ToolResult> {
    try {
      const { info, meta } = await this.client.readPlcInfo();
      return makeResult(true, info, null, meta);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err));
    }
  }

  private async handleReadCpuState(): Promise<ToolResult> {
    try {
      const { state, meta } = await this.client.readCpuState();
      return makeResult(true, { state }, null, meta);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err));
    }
  }

  private async handleSetCpuState(args: any): Promise<ToolResult> {
    if (!this.config.systemCmdsEnabled) {
      return makeResult(false, undefined, "System commands are disabled (enable S7_SYSTEM_CMDS_ENABLED to proceed)");
    }
    const state = String(args?.state || "");
    try {
      const meta = await this.client.setCpuState(state);
      return makeResult(true, { state: state.toUpperCase() }, null, meta);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { state });
    }
  }

  private async handleListTags(): Promise<ToolResult> {
    return makeResult(true, { tags: this.tagMap.list() });
  }

  private async handleReadTag(args: any): Promise<ToolResult> {
    const name = String(args?.name || "");
    const spec = this.tagMap.get(name);
    if (!spec) return makeResult(false, undefined, `Unknown tag '${name}'`);
    const area = normalizeArea(spec.area);
    try {
      if (area === "db") {
        const db = Number(spec.db_number || spec.db || 1);
        const offset = Number(spec.offset || 0);
        const size = Number(spec.size || 1);
        const { buffer } = await this.client.readDB(db, offset, size);
        return makeResult(true, { tag: name, raw_bytes_hex: bufferToHex(buffer) });
      }
      const start = Number(spec.byte || spec.start_byte || 0);
      const size = Number(spec.size || 1);
      const { buffer } = await this.client.readArea(area, start, size, Number(spec.db_number || 0));
      return makeResult(true, { tag: name, raw_bytes_hex: bufferToHex(buffer) });
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { tag: name });
    }
  }

  private async handleWriteTag(args: any): Promise<ToolResult> {
    if (!this.config.writesEnabled) return makeResult(false, undefined, "Writes are disabled by configuration");
    const name = String(args?.name || "");
    const spec = this.tagMap.get(name);
    if (!spec) return makeResult(false, undefined, `Unknown tag '${name}'`);
    const area = normalizeArea(spec.area);
    try {
      const payload = rawPayloadFromValue(args?.value);
      if (area === "db") {
        const db = Number(spec.db_number || spec.db || 1);
        const offset = Number(spec.offset || 0);
        const meta = await this.client.writeDB(db, offset, payload);
        return makeResult(true, { tag: name, written_bytes: payload.length }, null, meta);
      }
      const start = Number(spec.byte || spec.start_byte || 0);
      const meta = await this.client.writeArea(area, start, payload, Number(spec.db_number || 0));
      return makeResult(true, { tag: name, written_bytes: payload.length }, null, meta);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { tag: name });
    }
  }

  private async handlePing(): Promise<ToolResult> {
    return makeResult(true, {
      connection: this.client.connectionMeta(),
      writes_enabled: this.config.writesEnabled,
      system_cmds_enabled: this.config.systemCmdsEnabled,
      tag_count: this.tagMap.count(),
    });
  }
}

const config = loadEnv();
const server = new S7CommMCPServer(config);

server.run().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
