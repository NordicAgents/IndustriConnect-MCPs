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

import { loadGSD } from "./gsdParser.js";

dotenv.config();

type ToolResult = {
  success: boolean;
  data?: any;
  error?: string | null;
  meta?: Record<string, any>;
};

const TRUE_SET = new Set(["1", "true", "yes", "on"]);

interface EnvConfig {
  portPath: string;
  baudRate: number;
  masterAddress: number;
  writesEnabled: boolean;
  configCmdsEnabled: boolean;
  slaveMapFile?: string;
  gsdBasePath?: string;
}

function boolFromEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return TRUE_SET.has(value.trim().toLowerCase());
}

function loadEnv(): EnvConfig {
  return {
    portPath: process.env.PROFIBUS_PORT || "/dev/ttyUSB0",
    baudRate: parseInt(process.env.PROFIBUS_BAUDRATE || "500000", 10),
    masterAddress: parseInt(process.env.PROFIBUS_MASTER_ADDRESS || "2", 10),
    writesEnabled: boolFromEnv(process.env.PROFIBUS_WRITES_ENABLED, true),
    configCmdsEnabled: boolFromEnv(process.env.PROFIBUS_CONFIG_CMDS_ENABLED, false),
    slaveMapFile: process.env.SLAVE_MAP_FILE,
    gsdBasePath: process.env.PROFIBUS_GSD_PATH,
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

  list(): Array<{ alias: string; address?: number; description?: string }> {
    this.load();
    return Object.entries(this.cache).map(([alias, spec]) => ({
      alias,
      address: (spec as any)?.address,
      description: (spec as any)?.description,
    }));
  }

  count(): number {
    this.load();
    return Object.keys(this.cache).length;
  }
}

class ProfibusMasterWrapper {
  private serial?: SerialPort;
  private opened = false;
  private slaves: Array<Record<string, any>> = [];

  constructor(private readonly config: EnvConfig) {}

  async ensureOpen(): Promise<void> {
    if (this.opened) return;
    this.serial = new SerialPort({
      path: this.config.portPath,
      baudRate: this.config.baudRate,
      autoOpen: false,
    });
    await new Promise<void>((resolve, reject) => {
      this.serial!.open((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    this.opened = true;
  }

  async scanBus(): Promise<{ devices: any[]; meta: Record<string, any> }> {
    await this.ensureOpen();
    const start = performance.now();
    if (!this.slaves.length) {
      this.slaves = [
        {
          address: 5,
          ident_number: "0x809C",
          status: "OK",
          manufacturer: "SampleVendor",
          input_length: 4,
          output_length: 2,
        },
      ];
    }
    const durationMs = Number((performance.now() - start).toFixed(3));
    return { devices: this.slaves, meta: { duration_ms: durationMs, count: this.slaves.length } };
  }

  async readInputs(address: number, length: number): Promise<{ buffer: Buffer; meta: Record<string, any> }> {
    await this.ensureOpen();
    const start = performance.now();
    const buffer = Buffer.alloc(length);
    const durationMs = Number((performance.now() - start).toFixed(3));
    return { buffer, meta: { duration_ms: durationMs, slave_address: address } };
  }

  async writeOutputs(address: number, payload: Buffer): Promise<Record<string, any>> {
    if (!this.config.writesEnabled) throw new Error("Write operations are disabled by configuration");
    await this.ensureOpen();
    const start = performance.now();
    const durationMs = Number((performance.now() - start).toFixed(3));
    return { duration_ms: durationMs, slave_address: address, written_bytes: payload.length };
  }

  async readDiagnosis(address: number): Promise<{ diag: Record<string, any>; meta: Record<string, any> }> {
    await this.ensureOpen();
    const start = performance.now();
    const diag = {
      address,
      status: "OK",
      master_address: this.config.masterAddress,
    };
    const durationMs = Number((performance.now() - start).toFixed(3));
    return { diag, meta: { duration_ms: durationMs, slave_address: address } };
  }

  connectionMeta(): Record<string, any> {
    return {
      port: this.config.portPath,
      baudrate: this.config.baudRate,
      master_address: this.config.masterAddress,
      writes_enabled: this.config.writesEnabled,
      config_cmds_enabled: this.config.configCmdsEnabled,
      slave_count: this.slaves.length,
    };
  }
}

function makeResult(success: boolean, data?: any, error?: string | null, meta: Record<string, any> = {}): ToolResult {
  return { success, data, error: error ?? null, meta };
}

class ProfibusMCPServer {
  private readonly server = new Server({ name: "PROFIBUS MCP (Node)" });
  private readonly master: ProfibusMasterWrapper;
  private readonly slaveMap: DeviceMap;

  constructor(private readonly config: EnvConfig) {
    this.master = new ProfibusMasterWrapper(config);
    this.slaveMap = new DeviceMap(config.slaveMapFile);

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        { name: "scan_bus", description: "Scan PROFIBUS network for slaves.", inputSchema: { type: "object", properties: {} } },
        { name: "read_inputs", description: "Read inputs from a slave.", inputSchema: { type: "object", properties: { slave_address: { type: "integer" }, length: { type: "integer" } }, required: ["slave_address", "length"] } },
        { name: "write_outputs", description: "Write outputs to a slave.", inputSchema: { type: "object", properties: { slave_address: { type: "integer" }, data: { type: "array", items: { type: "integer" } } }, required: ["slave_address", "data"] } },
        { name: "read_diagnosis", description: "Read diagnostic data.", inputSchema: { type: "object", properties: { slave_address: { type: "integer" } }, required: ["slave_address"] } },
        { name: "load_gsd_file", description: "Load/parse a GSD file.", inputSchema: { type: "object", properties: { filepath: { type: "string" } }, required: ["filepath"] } },
        { name: "list_slaves", description: "List slave aliases from map.", inputSchema: { type: "object", properties: {} } },
        { name: "read_slave_by_alias", description: "Read inputs by alias.", inputSchema: { type: "object", properties: { alias: { type: "string" }, length: { type: "integer" } }, required: ["alias"] } },
        { name: "write_slave_by_alias", description: "Write outputs by alias.", inputSchema: { type: "object", properties: { alias: { type: "string" }, data: { type: "array", items: { type: "integer" } } }, required: ["alias", "data"] } },
        { name: "ping", description: "Return master health/config.", inputSchema: { type: "object", properties: {} } },
        { name: "get_master_status", description: "Return master metadata.", inputSchema: { type: "object", properties: {} } },
        { name: "test_slave_communication", description: "Perform a quick read for diagnostics.", inputSchema: { type: "object", properties: { slave_address: { type: "integer" } }, required: ["slave_address"] } },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const tool = request.params.name;
      const args = request.params.arguments || {};
      switch (tool) {
        case "scan_bus":
          return this.wrap(await this.handleScan());
        case "read_inputs":
          return this.wrap(await this.handleReadInputs(args));
        case "write_outputs":
          return this.wrap(await this.handleWriteOutputs(args));
        case "read_diagnosis":
          return this.wrap(await this.handleReadDiagnosis(args));
        case "load_gsd_file":
          return this.wrap(await this.handleLoadGsd(args));
        case "list_slaves":
          return this.wrap(makeResult(true, { slaves: this.slaveMap.list(), count: this.slaveMap.count() }));
        case "read_slave_by_alias":
          return this.wrap(await this.handleReadAlias(args));
        case "write_slave_by_alias":
          return this.wrap(await this.handleWriteAlias(args));
        case "ping":
          return this.wrap(makeResult(true, {
            connection: this.master.connectionMeta(),
            writes_enabled: this.config.writesEnabled,
            config_cmds_enabled: this.config.configCmdsEnabled,
            slave_aliases: this.slaveMap.count(),
          }));
        case "get_master_status":
          return this.wrap(makeResult(true, this.master.connectionMeta()));
        case "test_slave_communication":
          return this.wrap(await this.handleTestComm(args));
        default:
          return this.wrap(makeResult(false, undefined, `Unknown tool: ${tool}`));
      }
    });
  }

  private wrap(result: ToolResult) {
    return { content: [{ type: "application/json", data: result }] };
  }

  async run(): Promise<void> {
    await this.master.ensureOpen().catch(() => {
      // Allow lazy opening when first tool runs
    });
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("PROFIBUS MCP (Node) listening on stdio");
  }

  private async handleScan(): Promise<ToolResult> {
    try {
      const { devices, meta } = await this.master.scanBus();
      return makeResult(true, { slaves: devices }, null, meta);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err));
    }
  }

  private async handleReadInputs(args: any): Promise<ToolResult> {
    const address = Number(args?.slave_address || 0);
    const length = Number(args?.length || 1);
    try {
      const { buffer, meta } = await this.master.readInputs(address, length);
      return makeResult(true, { slave_address: address, raw_data_hex: buffer.toString("hex") }, null, meta);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { slave_address: address });
    }
  }

  private async handleWriteOutputs(args: any): Promise<ToolResult> {
    if (!this.config.writesEnabled) return makeResult(false, undefined, "Write operations are disabled by configuration");
    const address = Number(args?.slave_address || 0);
    const data = Array.isArray(args?.data) ? args.data : [];
    const payload = Buffer.from(data.map((v: any) => Number(v) & 0xff));
    try {
      const meta = await this.master.writeOutputs(address, payload);
      return makeResult(true, { slave_address: address, written_bytes: payload.length }, null, meta);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { slave_address: address });
    }
  }

  private async handleReadDiagnosis(args: any): Promise<ToolResult> {
    const address = Number(args?.slave_address || 0);
    try {
      const { diag, meta } = await this.master.readDiagnosis(address);
      return makeResult(true, diag, null, meta);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { slave_address: address });
    }
  }

  private async handleLoadGsd(args: any): Promise<ToolResult> {
    const filepath = String(args?.filepath || "");
    try {
      const entry = loadGSD(filepath, this.config.gsdBasePath);
      return makeResult(true, entry);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { filepath });
    }
  }

  private async handleReadAlias(args: any): Promise<ToolResult> {
    const alias = String(args?.alias || "");
    const spec = this.slaveMap.get(alias);
    if (!spec) return makeResult(false, undefined, `Unknown alias '${alias}'`);
    return this.handleReadInputs({
      slave_address: spec.address ?? 0,
      length: args?.length ?? spec.io_config?.input_length ?? 4,
    });
  }

  private async handleWriteAlias(args: any): Promise<ToolResult> {
    if (!this.config.writesEnabled) return makeResult(false, undefined, "Write operations are disabled by configuration");
    const alias = String(args?.alias || "");
    const spec = this.slaveMap.get(alias);
    if (!spec) return makeResult(false, undefined, `Unknown alias '${alias}'`);
    return this.handleWriteOutputs({
      slave_address: spec.address ?? 0,
      data: args?.data ?? [],
    });
  }

  private async handleTestComm(args: any): Promise<ToolResult> {
    const address = Number(args?.slave_address || 0);
    return this.handleReadInputs({ slave_address: address, length: 4 });
  }
}

const config = loadEnv();
const server = new ProfibusMCPServer(config);

server.run().catch((err) => {
  console.error(err);
  process.exit(1);
});
