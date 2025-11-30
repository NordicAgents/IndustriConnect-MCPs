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
  iface: string;
  controllerIp: string;
  writesEnabled: boolean;
  configCmdsEnabled: boolean;
  deviceMapFile?: string;
  gsdBasePath?: string;
}

function boolFromEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return TRUE_SET.has(value.trim().toLowerCase());
}

function loadEnv(): EnvConfig {
  return {
    iface: process.env.PROFINET_INTERFACE || "eth0",
    controllerIp: process.env.PROFINET_CONTROLLER_IP || "192.168.1.1",
    writesEnabled: boolFromEnv(process.env.PROFINET_WRITES_ENABLED, true),
    configCmdsEnabled: boolFromEnv(process.env.PROFINET_CONFIG_CMDS_ENABLED, false),
    deviceMapFile: process.env.DEVICE_MAP_FILE,
    gsdBasePath: process.env.PROFINET_GSD_PATH,
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

  list(): Array<{ alias: string; device_name?: string; ip_address?: string }> {
    this.load();
    return Object.entries(this.cache).map(([alias, spec]) => ({
      alias,
      device_name: (spec as any)?.device_name,
      ip_address: (spec as any)?.ip_address,
    }));
  }

  count(): number {
    this.load();
    return Object.keys(this.cache).length;
  }
}

class ProfinetController {
  constructor(private readonly config: EnvConfig) {}

  connectionMeta(): Record<string, any> {
    return {
      interface: this.config.iface,
      controller_ip: this.config.controllerIp,
    };
  }

  async discoverDevices(timeout?: number): Promise<{ devices: any[]; meta: Record<string, any> }> {
    const start = performance.now();
    // TODO: implement DCP discovery
    const devices = [
      {
        device_name: "PN-DEVICE-01",
        mac_address: "00:11:22:33:44:55",
        ip_address: "192.168.1.100",
        vendor: "SampleVendor",
        device_type: "IO Device",
      },
    ];
    const durationMs = Number((performance.now() - start).toFixed(3));
    return { devices, meta: { duration_ms: durationMs, timeout } };
  }

  async readIO(deviceName: string, slot: number, subslot: number, length: number): Promise<{ buffer: Buffer; meta: Record<string, any> }> {
    const start = performance.now();
    // TODO: implement PROFINET IO read
    const buffer = Buffer.alloc(length);
    const durationMs = Number((performance.now() - start).toFixed(3));
    return { buffer, meta: { duration_ms: durationMs, device_name: deviceName, slot, subslot } };
  }

  async writeIO(deviceName: string, slot: number, subslot: number, payload: Buffer): Promise<Record<string, any>> {
    if (!this.config.writesEnabled) {
      throw new Error("Write operations are disabled by configuration");
    }
    const start = performance.now();
    // TODO: implement PROFINET IO write
    const durationMs = Number((performance.now() - start).toFixed(3));
    return { duration_ms: durationMs, device_name: deviceName, written_bytes: payload.length, slot, subslot };
  }

  async setDeviceName(deviceMac: string, name: string): Promise<Record<string, any>> {
    if (!this.config.configCmdsEnabled) {
      throw new Error("Configuration commands are disabled (set PROFINET_CONFIG_CMDS_ENABLED=true)");
    }
    const start = performance.now();
    // TODO: DCP set name
    const durationMs = Number((performance.now() - start).toFixed(3));
    return { duration_ms: durationMs, device_mac: deviceMac, name };
  }

  async setDeviceIp(deviceMac: string, ip: string, subnet: string, gateway?: string): Promise<Record<string, any>> {
    if (!this.config.configCmdsEnabled) {
      throw new Error("Configuration commands are disabled");
    }
    const start = performance.now();
    const durationMs = Number((performance.now() - start).toFixed(3));
    return { duration_ms: durationMs, device_mac: deviceMac, ip, subnet, gateway };
  }

  async identify(deviceMac: string, durationSeconds: number): Promise<Record<string, any>> {
    const start = performance.now();
    const durationMs = Number((performance.now() - start).toFixed(3));
    return { duration_ms: durationMs, device_mac: deviceMac, identify_duration_s: durationSeconds };
  }
}

function makeResult(success: boolean, data?: any, error?: string | null, meta?: Record<string, any>): ToolResult {
  return { success, data, error: error ?? null, meta: meta || {} };
}

class ProfinetMCPServer {
  private readonly server = new Server({ name: "PROFINET MCP (Node)" });
  private readonly controller: ProfinetController;
  private readonly deviceMap: DeviceMap;
  private readonly tools: Tool[];

  constructor(private readonly config: EnvConfig) {
    this.controller = new ProfinetController(config);
    this.deviceMap = new DeviceMap(config.deviceMapFile);
    this.tools = [
      { name: "discover_devices", description: "Discover PROFINET devices via DCP.", inputSchema: { type: "object", properties: { timeout: { type: "integer" } } } },
      { name: "get_device_info", description: "Return device info by name/IP.", inputSchema: { type: "object", properties: { device_name: { type: "string" } }, required: ["device_name"] } },
      { name: "set_device_name", description: "Set device name (DCP).", inputSchema: { type: "object", properties: { device_mac: { type: "string" }, name: { type: "string" } }, required: ["device_mac", "name"] } },
      { name: "set_device_ip", description: "Set device IP configuration (DCP).", inputSchema: { type: "object", properties: { device_mac: { type: "string" }, ip_address: { type: "string" }, subnet_mask: { type: "string" }, gateway: { type: "string" } }, required: ["device_mac", "ip_address", "subnet_mask"] } },
      { name: "identify_device", description: "Trigger device identification (LED).", inputSchema: { type: "object", properties: { device_mac: { type: "string" }, duration_s: { type: "integer" } }, required: ["device_mac"] } },
      { name: "read_io_data", description: "Read IO data for slot/subslot.", inputSchema: { type: "object", properties: { device_name: { type: "string" }, slot: { type: "integer" }, subslot: { type: "integer" }, data_length: { type: "integer" } }, required: ["device_name", "slot", "subslot", "data_length"] } },
      { name: "write_io_data", description: "Write IO data for slot/subslot.", inputSchema: { type: "object", properties: { device_name: { type: "string" }, slot: { type: "integer" }, subslot: { type: "integer" }, data: { type: "array", items: { type: "integer" } } }, required: ["device_name", "slot", "subslot", "data"] } },
      { name: "load_gsd_file", description: "Parse a GSD/GSDML file.", inputSchema: { type: "object", properties: { filepath: { type: "string" } }, required: ["filepath"] } },
      { name: "list_devices", description: "List device map entries.", inputSchema: { type: "object", properties: {} } },
      { name: "read_device_by_alias", description: "Read IO data by alias from device map.", inputSchema: { type: "object", properties: { alias: { type: "string" } }, required: ["alias"] } },
      { name: "write_device_by_alias", description: "Write IO data by alias from device map.", inputSchema: { type: "object", properties: { alias: { type: "string" }, data: { type: "array", items: { type: "integer" } } }, required: ["alias", "data"] } },
      { name: "ping", description: "Return health/config info.", inputSchema: { type: "object", properties: {} } },
      { name: "get_connection_status", description: "Return connection metadata.", inputSchema: { type: "object", properties: {} } },
      { name: "test_device_communication", description: "Perform a lightweight read to verify connectivity.", inputSchema: { type: "object", properties: { device_name: { type: "string" } }, required: ["device_name"] } },
    ];

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: this.tools }));
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const tool = request.params.name;
      const args = request.params.arguments || {};
      switch (tool) {
        case "discover_devices":
          return this.wrap(await this.handleDiscover(args));
        case "get_device_info":
          return this.wrap(await this.handleGetDeviceInfo(args));
        case "set_device_name":
          return this.wrap(await this.handleSetDeviceName(args));
        case "set_device_ip":
          return this.wrap(await this.handleSetDeviceIp(args));
        case "identify_device":
          return this.wrap(await this.handleIdentify(args));
        case "read_io_data":
          return this.wrap(await this.handleReadIO(args));
        case "write_io_data":
          return this.wrap(await this.handleWriteIO(args));
        case "load_gsd_file":
          return this.wrap(await this.handleLoadGsd(args));
        case "list_devices":
          return this.wrap(makeResult(true, { devices: this.deviceMap.list(), count: this.deviceMap.count() }));
        case "read_device_by_alias":
          return this.wrap(await this.handleReadAlias(args));
        case "write_device_by_alias":
          return this.wrap(await this.handleWriteAlias(args));
        case "ping":
          return this.wrap(makeResult(true, {
            connection: this.controller.connectionMeta(),
            writes_enabled: this.config.writesEnabled,
            config_cmds_enabled: this.config.configCmdsEnabled,
            device_aliases: this.deviceMap.count(),
          }));
        case "get_connection_status":
          return this.wrap(makeResult(true, this.controller.connectionMeta()));
        case "test_device_communication":
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
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("PROFINET MCP (Node) listening on stdio");
  }

  private async handleDiscover(args: any): Promise<ToolResult> {
    try {
      const { devices, meta } = await this.controller.discoverDevices(args?.timeout ? Number(args.timeout) : undefined);
      return makeResult(true, { devices }, null, meta);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err));
    }
  }

  private async handleGetDeviceInfo(args: any): Promise<ToolResult> {
    const name = String(args?.device_name || "");
    const result = await this.handleDiscover({});
    if (!result.success || !Array.isArray(result.data?.devices)) return result;
    const match = result.data.devices.find((d: any) => d.device_name === name || d.ip_address === name);
    if (!match) return makeResult(false, undefined, "Device not found", { device_name: name });
    return makeResult(true, match, null, result.meta);
  }

  private async handleSetDeviceName(args: any): Promise<ToolResult> {
    if (!this.config.configCmdsEnabled) return makeResult(false, undefined, "Configuration commands are disabled");
    const mac = String(args?.device_mac || "");
    const name = String(args?.name || "");
    try {
      const meta = await this.controller.setDeviceName(mac, name);
      return makeResult(true, { device_mac: mac, name }, null, meta);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { device_mac: mac });
    }
  }

  private async handleSetDeviceIp(args: any): Promise<ToolResult> {
    if (!this.config.configCmdsEnabled) return makeResult(false, undefined, "Configuration commands are disabled");
    const mac = String(args?.device_mac || "");
    const ip = String(args?.ip_address || "");
    const subnet = String(args?.subnet_mask || "");
    const gateway = args?.gateway ? String(args.gateway) : undefined;
    try {
      const meta = await this.controller.setDeviceIp(mac, ip, subnet, gateway);
      return makeResult(true, { device_mac: mac, ip_address: ip }, null, meta);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { device_mac: mac });
    }
  }

  private async handleIdentify(args: any): Promise<ToolResult> {
    const mac = String(args?.device_mac || "");
    const duration = args?.duration_s ? Number(args.duration_s) : 5;
    try {
      const meta = await this.controller.identify(mac, duration);
      return makeResult(true, { device_mac: mac, identify_duration_s: duration }, null, meta);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { device_mac: mac });
    }
  }

  private async handleReadIO(args: any): Promise<ToolResult> {
    const name = String(args?.device_name || "");
    const slot = Number(args?.slot || 0);
    const subslot = Number(args?.subslot || 0);
    const length = Number(args?.data_length || 1);
    try {
      const { buffer, meta } = await this.controller.readIO(name, slot, subslot, length);
      return makeResult(true, { device_name: name, slot, subslot, raw_data_hex: buffer.toString("hex") }, null, meta);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { device_name: name });
    }
  }

  private async handleWriteIO(args: any): Promise<ToolResult> {
    if (!this.config.writesEnabled) return makeResult(false, undefined, "Write operations are disabled by configuration");
    const name = String(args?.device_name || "");
    const slot = Number(args?.slot || 0);
    const subslot = Number(args?.subslot || 0);
    const data = Array.isArray(args?.data) ? args.data : [];
    const payload = Buffer.from(data.map((v: any) => Number(v) & 0xff));
    try {
      const meta = await this.controller.writeIO(name, slot, subslot, payload);
      return makeResult(true, { device_name: name, written_bytes: payload.length }, null, meta);
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { device_name: name });
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
    const spec = this.deviceMap.get(alias);
    if (!spec) return makeResult(false, undefined, `Unknown alias '${alias}'`);
    return this.handleReadIO({
      device_name: spec.device_name || alias,
      slot: spec.slot ?? 0,
      subslot: spec.subslot ?? 1,
      data_length: spec.data_length ?? 8,
    });
  }

  private async handleWriteAlias(args: any): Promise<ToolResult> {
    if (!this.config.writesEnabled) return makeResult(false, undefined, "Write operations are disabled by configuration");
    const alias = String(args?.alias || "");
    const spec = this.deviceMap.get(alias);
    if (!spec) return makeResult(false, undefined, `Unknown alias '${alias}'`);
    return this.handleWriteIO({
      device_name: spec.device_name || alias,
      slot: spec.slot ?? 0,
      subslot: spec.subslot ?? 1,
      data: args?.data ?? [],
    });
  }

  private async handleTestComm(args: any): Promise<ToolResult> {
    const name = String(args?.device_name || "");
    const read = await this.handleReadIO({ device_name: name, slot: 0, subslot: 1, data_length: 4 });
    if (!read.success) return read;
    return makeResult(true, { device_name: name, bytes: read.data?.raw_data_hex }, null, read.meta);
  }
}

const envConfig = loadEnv();
const server = new ProfinetMCPServer(envConfig);

server.run().catch((err) => {
  console.error(err);
  process.exit(1);
});
