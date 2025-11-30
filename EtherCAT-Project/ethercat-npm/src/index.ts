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

import { loadESI } from "./esiParser.js";

dotenv.config();

type ToolResult = {
  success: boolean;
  data?: any;
  error?: string | null;
  meta?: Record<string, any>;
};

const TRUE_SET = new Set(["1", "true", "yes", "on"]);

interface EnvConfig {
  iface: string;
  cycleTimeUs: number;
  writesEnabled: boolean;
  stateChangesEnabled: boolean;
  slaveMapFile?: string;
  esiBasePath?: string;
}

function boolFromEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return TRUE_SET.has(value.trim().toLowerCase());
}

function loadEnv(): EnvConfig {
  return {
    iface: process.env.ETHERCAT_INTERFACE || "eth0",
    cycleTimeUs: parseInt(process.env.ETHERCAT_CYCLE_TIME || "1000", 10),
    writesEnabled: boolFromEnv(process.env.ETHERCAT_WRITES_ENABLED, true),
    stateChangesEnabled: boolFromEnv(process.env.ETHERCAT_STATE_CHANGE_ENABLED, false),
    slaveMapFile: process.env.SLAVE_MAP_FILE,
    esiBasePath: process.env.ETHERCAT_ESI_PATH,
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

  list(): Array<{ alias: string; position?: number; description?: string }> {
    this.load();
    return Object.entries(this.cache).map(([alias, spec]) => ({
      alias,
      position: (spec as any)?.position,
      description: (spec as any)?.description,
    }));
  }

  count(): number {
    this.load();
    return Object.keys(this.cache).length;
  }
}

class EthercatMasterWrapper {
  private opened = false;
  private slaves: Array<Record<string, any>> = [];

  constructor(private readonly config: EnvConfig) {}

  async ensureOpen(): Promise<void> {
    if (this.opened) return;
    // TODO: integrate with SOEM bindings
    this.opened = true;
  }

  async scanSlaves(): Promise<{ devices: any[]; meta: Record<string, any> }> {
    await this.ensureOpen();
    const start = performance.now();
    if (!this.slaves.length) {
      this.slaves = [
        {
          position: 0,
          name: "EK1100",
          state: "OP",
          vendor_id: "0x00000002",
          product_code: "0x044C2C52",
          revision: "0x00010000",
          input_size: 8,
          output_size: 8,
        },
      ];
    }
    const durationMs = Number((performance.now() - start).toFixed(3));
    return { devices: this.slaves, meta: { duration_ms: durationMs, count: this.slaves.length } };
  }

  async readPDO(position: number, offset: number, length: number): Promise<{ buffer: Buffer; meta: Record<string, any> }> {
    await this.ensureOpen();
    const start = performance.now();
    const buffer = Buffer.alloc(length);
    const durationMs = Number((performance.now() - start).toFixed(3));
    return { buffer, meta: { duration_ms: durationMs, slave_position: position, offset } };
  }

  async writePDO(position: number, offset: number, payload: Buffer): Promise<Record<string, any>> {
    if (!this.config.writesEnabled) throw new Error("Write operations are disabled");
    await this.ensureOpen();
    const start = performance.now();
    const durationMs = Number((performance.now() - start).toFixed(3));
    return { duration_ms: durationMs, slave_position: position, offset, written_bytes: payload.length };
  }

  async readSDO(position: number, index: number, subindex: number): Promise<{ value: any; meta: Record<string, any> }> {
    await this.ensureOpen();
    const start = performance.now();
    const value = { index: `0x${index.toString(16)}`, subindex, value: 0 };
    const durationMs = Number((performance.now() - start).toFixed(3));
    return { value, meta: { duration_ms: durationMs, slave_position: position } };
  }

  async writeSDO(position: number, index: number, subindex: number, value: any): Promise<Record<string, any>> {
    if (!this.config.writesEnabled) throw new Error("Write operations are disabled");
    await this.ensureOpen();
    const start = performance.now();
    const durationMs = Number((performance.now() - start).toFixed(3));
    return { duration_ms: durationMs, slave_position: position, index: `0x${index.toString(16)}`, subindex };
  }

  async setSlaveState(position: number, state: string): Promise<Record<string, any>> {
    if (!this.config.stateChangesEnabled) throw new Error("State changes are disabled");
    await this.ensureOpen();
    const start = performance.now();
    const durationMs = Number((performance.now() - start).toFixed(3));
    return { duration_ms: durationMs, slave_position: position, state };
  }

  connectionMeta(): Record<string, any> {
    return {
      interface: this.config.iface,
      cycle_time_us: this.config.cycleTimeUs,
      writes_enabled: this.config.writesEnabled,
      state_change_enabled: this.config.stateChangesEnabled,
      slave_count: this.slaves.length,
    };
  }
}

function makeResult(success: boolean, data?: any, error?: string | null, meta?: Record<string, any>): ToolResult {
  return { success, data, error: error ?? null, meta: meta || {} };
}

class EthercatMCPServer {
  private readonly server = new Server({ name: "EtherCAT MCP (Node)" });
  private readonly tools: Tool[];
  private readonly master: EthercatMasterWrapper;
  private readonly slaveMap: DeviceMap;

  constructor(private readonly config: EnvConfig) {
    this.master = new EthercatMasterWrapper(config);
    this.slaveMap = new DeviceMap(config.slaveMapFile);
    this.tools = [
      { name: "scan_network", description: "Scan for EtherCAT slaves.", inputSchema: { type: "object", properties: {} } },
      { name: "get_slave_info", description: "Get info for a slave position.", inputSchema: { type: "object", properties: { slave_position: { type: "integer" } }, required: ["slave_position"] } },
      { name: "read_pdo", description: "Read PDO data.", inputSchema: { type: "object", properties: { slave_position: { type: "integer" }, offset: { type: "integer" }, length: { type: "integer" } }, required: ["slave_position", "offset", "length"] } },
      { name: "write_pdo", description: "Write PDO data.", inputSchema: { type: "object", properties: { slave_position: { type: "integer" }, offset: { type: "integer" }, data: { type: "array", items: { type: "integer" } } }, required: ["slave_position", "offset", "data"] } },
      { name: "read_sdo", description: "Read SDO entry.", inputSchema: { type: "object", properties: { slave_position: { type: "integer" }, index: { type: "string" }, subindex: { type: "integer" } }, required: ["slave_position", "index", "subindex"] } },
      { name: "write_sdo", description: "Write SDO entry.", inputSchema: { type: "object", properties: { slave_position: { type: "integer" }, index: { type: "string" }, subindex: { type: "integer" }, value: {} }, required: ["slave_position", "index", "subindex", "value"] } },
      { name: "set_slave_state", description: "Change slave state (INIT/PREOP/SAFEOP/OP).", inputSchema: { type: "object", properties: { slave_position: { type: "integer" }, state: { type: "string" } }, required: ["slave_position", "state"] } },
      { name: "load_esi_file", description: "Parse an ESI file.", inputSchema: { type: "object", properties: { filepath: { type: "string" } }, required: ["filepath"] } },
      { name: "list_slaves", description: "List configured slave aliases.", inputSchema: { type: "object", properties: {} } },
      { name: "read_slave_by_alias", description: "Read PDO data by alias.", inputSchema: { type: "object", properties: { alias: { type: "string" }, length: { type: "integer" } }, required: ["alias"] } },
      { name: "write_slave_by_alias", description: "Write PDO data by alias.", inputSchema: { type: "object", properties: { alias: { type: "string" }, data: { type: "array", items: { type: "integer" } } }, required: ["alias", "data"] } },
      { name: "ping", description: "Return health info.", inputSchema: { type: "object", properties: {} } },
      { name: "get_master_status", description: "Return master metadata.", inputSchema: { type: "object", properties: {} } },
      { name: "test_slave_communication", description: "Perform a quick PDO read for diagnostics.", inputSchema: { type: "object", properties: { slave_position: { type: "integer" } }, required: ["slave_position"] } }
    ];

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: this.tools }));
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const tool = request.params.name;
      const args = request.params.arguments || {};
      switch (tool) {
        case "scan_network":
          return this.wrap(await this.handleScan());
        case "get_slave_info":
          return this.wrap(await this.handleGetSlaveInfo(args));
        case "read_pdo":
          return this.wrap(await this.handleReadPdo(args));
        case "write_pdo":
          return this.wrap(await this.handleWritePdo(args));
        case "read_sdo":
          return this.wrap(await this.handleReadSdo(args));
        case "write_sdo":
          return this.wrap(await this.handleWriteSdo(args));
        case "set_slave_state":
          return this.wrap(await this.handleSetSlaveState(args));
        case "load_esi_file":
          return this.wrap(await this.handleLoadEsi(args));
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
            state_change_enabled: this.config.stateChangesEnabled,
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
    await this.master.ensureOpen();
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("EtherCAT MCP (Node) listening on stdio");
  }

  private async handleScan(): Promise<ToolResult> {
    try {
      const { devices, meta } = await this.master.scanSlaves();
      return makeResult(true, { slaves: devices }, null, meta);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err));
    }
  }

  private async handleGetSlaveInfo(args: any): Promise<ToolResult> {
    const pos = Number(args?.slave_position || 0);
    const scan = await this.handleScan();
    if (!scan.success) return scan;
    const list = scan.data?.slaves || [];
    if (pos >= list.length) return makeResult(false, undefined, "Slave position out of range", { slave_position: pos });
    return makeResult(true, list[pos]);
  }

  private async handleReadPdo(args: any): Promise<ToolResult> {
    const pos = Number(args?.slave_position || 0);
    const offset = Number(args?.offset || 0);
    const length = Number(args?.length || 1);
    try {
      const { buffer, meta } = await this.master.readPDO(pos, offset, length);
      return makeResult(true, { slave_position: pos, offset, raw_data_hex: buffer.toString("hex") }, null, meta);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { slave_position: pos });
    }
  }

  private async handleWritePdo(args: any): Promise<ToolResult> {
    if (!this.config.writesEnabled) return makeResult(false, undefined, "Write operations are disabled by configuration");
    const pos = Number(args?.slave_position || 0);
    const offset = Number(args?.offset || 0);
    const data = Array.isArray(args?.data) ? args.data : [];
    const payload = Buffer.from(data.map((v: any) => Number(v) & 0xff));
    try {
      const meta = await this.master.writePDO(pos, offset, payload);
      return makeResult(true, { slave_position: pos, written_bytes: payload.length }, null, meta);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { slave_position: pos });
    }
  }

  private async handleReadSdo(args: any): Promise<ToolResult> {
    const pos = Number(args?.slave_position || 0);
    const index = parseInt(String(args?.index || "0"), 16);
    const sub = Number(args?.subindex || 0);
    try {
      const { value, meta } = await this.master.readSDO(pos, index, sub);
      return makeResult(true, value, null, meta);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { slave_position: pos });
    }
  }

  private async handleWriteSdo(args: any): Promise<ToolResult> {
    if (!this.config.writesEnabled) return makeResult(false, undefined, "Write operations are disabled by configuration");
    const pos = Number(args?.slave_position || 0);
    const index = parseInt(String(args?.index || "0"), 16);
    const sub = Number(args?.subindex || 0);
    try {
      const meta = await this.master.writeSDO(pos, index, sub, args?.value);
      return makeResult(true, { slave_position: pos, index: args?.index, subindex: sub, written: args?.value }, null, meta);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { slave_position: pos });
    }
  }

  private async handleSetSlaveState(args: any): Promise<ToolResult> {
    if (!this.config.stateChangesEnabled) return makeResult(false, undefined, "State changes are disabled by configuration");
    const pos = Number(args?.slave_position || 0);
    const state = String(args?.state || "");
    try {
      const meta = await this.master.setSlaveState(pos, state);
      return makeResult(true, { slave_position: pos, state }, null, meta);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { slave_position: pos });
    }
  }

  private async handleLoadEsi(args: any): Promise<ToolResult> {
    const filepath = String(args?.filepath || "");
    try {
      const entry = loadESI(filepath, this.config.esiBasePath);
      return makeResult(true, entry);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { filepath });
    }
  }

  private async handleReadAlias(args: any): Promise<ToolResult> {
    const alias = String(args?.alias || "");
    const spec = this.slaveMap.get(alias);
    if (!spec) return makeResult(false, undefined, `Unknown alias '${alias}'`);
    return this.handleReadPdo({
      slave_position: spec.position ?? 0,
      offset: spec.offset ?? 0,
      length: args?.length ?? spec.data_length ?? 8,
    });
  }

  private async handleWriteAlias(args: any): Promise<ToolResult> {
    if (!this.config.writesEnabled) return makeResult(false, undefined, "Write operations are disabled by configuration");
    const alias = String(args?.alias || "");
    const spec = this.slaveMap.get(alias);
    if (!spec) return makeResult(false, undefined, `Unknown alias '${alias}'`);
    return this.handleWritePdo({
      slave_position: spec.position ?? 0,
      offset: spec.offset ?? 0,
      data: args?.data ?? [],
    });
  }

  private async handleTestComm(args: any): Promise<ToolResult> {
    const pos = Number(args?.slave_position || 0);
    const read = await this.handleReadPdo({ slave_position: pos, offset: 0, length: 4 });
    return read;
  }
}

const config = loadEnv();
const server = new EthercatMCPServer(config);

server.run().catch((err) => {
  console.error(err);
  process.exit(1);
});
