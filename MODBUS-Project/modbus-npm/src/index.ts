#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import ModbusSerialPkg from "modbus-serial";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

// -----------------------------
// Env configuration
// -----------------------------

const MODBUS_TYPE = (process.env.MODBUS_TYPE || "tcp").toLowerCase(); // tcp, udp, serial
const MODBUS_HOST = process.env.MODBUS_HOST || "127.0.0.1";
const MODBUS_PORT = parseInt(process.env.MODBUS_PORT || "502", 10);
const MODBUS_SERIAL_PORT = process.env.MODBUS_SERIAL_PORT || "/dev/ttyUSB0";
const MODBUS_BAUDRATE = parseInt(process.env.MODBUS_BAUDRATE || "9600", 10);
const MODBUS_PARITY = process.env.MODBUS_PARITY || "N"; // 'N','E','O'
const MODBUS_STOPBITS = parseInt(process.env.MODBUS_STOPBITS || "1", 10);
const MODBUS_BYTESIZE = parseInt(process.env.MODBUS_BYTESIZE || "8", 10);
const MODBUS_TIMEOUT = parseFloat(process.env.MODBUS_TIMEOUT || "1"); // seconds
const MODBUS_DEFAULT_SLAVE_ID = parseInt(process.env.MODBUS_DEFAULT_SLAVE_ID || "1", 10);

const MODBUS_MAX_RETRIES = parseInt(process.env.MODBUS_MAX_RETRIES || "2", 10);
const MODBUS_RETRY_BACKOFF_BASE = parseFloat(process.env.MODBUS_RETRY_BACKOFF_BASE || "0.2");
const MODBUS_TOOL_TIMEOUT = process.env.MODBUS_TOOL_TIMEOUT ? parseFloat(process.env.MODBUS_TOOL_TIMEOUT) : undefined;
const MODBUS_WRITES_ENABLED = (() => {
  const v = process.env.MODBUS_WRITES_ENABLED;
  if (!v) return true;
  return ["1", "true", "t", "yes", "y", "on"].includes(v.trim().toLowerCase());
})();

const REGISTER_MAP_FILE = process.env.REGISTER_MAP_FILE;
let TAG_MAP: Record<string, any> = {};
if (REGISTER_MAP_FILE && fs.existsSync(REGISTER_MAP_FILE)) {
  try {
    const buf = fs.readFileSync(REGISTER_MAP_FILE, "utf-8");
    TAG_MAP = JSON.parse(buf);
  } catch (e) {
    TAG_MAP = {};
  }
}

// -----------------------------
// Helpers: retry, timeout, results
// -----------------------------

type ToolResult = {
  success: boolean;
  data?: any;
  error?: string | null;
  meta?: Record<string, any>;
};

function makeResult(success: boolean, data?: any, error?: string | null, meta?: Record<string, any>): ToolResult {
  return { success, data, error: error ?? null, meta: meta || {} };
}

async function withTimeout<T>(p: Promise<T>, secs?: number): Promise<T> {
  if (!secs || secs <= 0) return p;
  return new Promise<T>((resolve, reject) => {
    const to = setTimeout(() => reject(new Error("Timeout")), Math.round(secs * 1000));
    p.then((v) => { clearTimeout(to); resolve(v); }, (e) => { clearTimeout(to); reject(e); });
  });
}

async function retryCall<T>(
  op: string,
  callFactory: () => Promise<T>,
  maxRetries: number,
  timeoutSecs?: number
): Promise<{ result?: T; error?: string; durationMs: number; attempts: number }>
{
  const start = performance.now();
  let attempt = 0;
  let lastErr: string | undefined;
  while (true) {
    attempt += 1;
    try {
      const res = await withTimeout(callFactory(), timeoutSecs);
      return { result: res, durationMs: performance.now() - start, attempts: attempt };
    } catch (e: any) {
      lastErr = `${e?.name || "Error"}: ${e?.message || String(e)}`;
      if (attempt > maxRetries) break;
      const backoff = MODBUS_RETRY_BACKOFF_BASE * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, Math.round(backoff * 1000)));
    }
  }
  return { error: lastErr, durationMs: performance.now() - start, attempts: attempt };
}

async function chunkedRead<T>(
  label: string,
  readFunc: (start: number, size: number) => Promise<T>,
  startAddress: number,
  totalCount: number,
  perRequestLimit: number,
  extract: (res: T) => any[] | undefined,
  timeoutSecs?: number
): Promise<{ values?: any[]; error?: string; meta: Record<string, any> }>
{
  if (totalCount <= 0) return { error: "Count must be positive", meta: {} };
  const values: any[] = [];
  const chunks: any[] = [];
  let remaining = totalCount;
  let current = startAddress;
  while (remaining > 0) {
    const size = Math.min(remaining, perRequestLimit);
    const { result, error, durationMs, attempts } = await retryCall(
      `${label}[${current}:${current + size - 1}]`,
      async () => await readFunc(current, size),
      MODBUS_MAX_RETRIES,
      timeoutSecs
    );
    if (error) return { error, meta: { partial: values, chunks } };
    const arr = extract(result as T);
    if (!arr) return { error: "Malformed response", meta: { partial: values, chunks } };
    values.push(...arr.slice(0, size));
    chunks.push({ address: current, count: size, duration_ms: Math.round(durationMs * 1000) / 1000, attempts });
    current += size;
    remaining -= size;
  }
  return { values, meta: { chunks } };
}

// -----------------------------
// Endian helpers for typed decode/encode
// -----------------------------

const DTYPE_SIZES: Record<string, number> = {
  int16: 1,
  uint16: 1,
  int32: 2,
  uint32: 2,
  float32: 2,
  int64: 4,
  uint64: 4,
  float64: 4,
};

function toPairs(bytes: number[]): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < bytes.length; i += 2) out.push([bytes[i], bytes[i + 1]]);
  return out;
}

function pairsToBytes(pairs: number[][]): number[] {
  return pairs.flat();
}

// For reading: take N 16-bit regs for one value, split each reg into [hi,lo] bytes.
// Apply wordorder by reordering 2-byte pairs. Then interpret using byteorder (BE/LE).
function decodeTyped(
  regs: number[],
  dtype: string,
  count: number,
  byteorder: "big" | "little",
  wordorder: "big" | "little"
): any[] {
  const sizeRegs = DTYPE_SIZES[dtype];
  if (!sizeRegs) throw new Error(`Unsupported dtype: ${dtype}`);
  const expected = sizeRegs * count;
  if (regs.length < expected) throw new Error(`Insufficient registers: have ${regs.length}, need ${expected}`);

  const out: any[] = [];
  for (let i = 0; i < count; i++) {
    const chunkRegs = regs.slice(i * sizeRegs, (i + 1) * sizeRegs);
    // split to bytes (big-endian within each 16-bit word)
    const pairs = chunkRegs.map((r) => [(r >> 8) & 0xff, r & 0xff]);
    // apply word order
    const orderedPairs = wordorder === "little" ? pairs.slice().reverse() : pairs;
    const bytes = pairsToBytes(orderedPairs);
    const buf = Buffer.from(bytes);
    switch (dtype) {
      case "int16":
        out.push(byteorder === "big" ? buf.readInt16BE(0) : buf.readInt16LE(0));
        break;
      case "uint16":
        out.push(byteorder === "big" ? buf.readUInt16BE(0) : buf.readUInt16LE(0));
        break;
      case "int32":
        out.push(byteorder === "big" ? buf.readInt32BE(0) : buf.readInt32LE(0));
        break;
      case "uint32":
        out.push(byteorder === "big" ? buf.readUInt32BE(0) : buf.readUInt32LE(0));
        break;
      case "float32":
        out.push(byteorder === "big" ? buf.readFloatBE(0) : buf.readFloatLE(0));
        break;
      case "int64": {
        const hi = byteorder === "big" ? buf.readInt32BE(0) : buf.readInt32LE(4);
        const lo = byteorder === "big" ? buf.readUInt32BE(4) : buf.readUInt32LE(0);
        // Reconstruct 64-bit signed as BigInt
        const big = (BigInt(hi) << 32n) | BigInt(lo);
        out.push(Number(big));
        break;
      }
      case "uint64": {
        const hi = byteorder === "big" ? buf.readUInt32BE(0) : buf.readUInt32LE(4);
        const lo = byteorder === "big" ? buf.readUInt32BE(4) : buf.readUInt32LE(0);
        const big = (BigInt(hi) << 32n) | BigInt(lo);
        out.push(Number(big));
        break;
      }
      case "float64":
        out.push(byteorder === "big" ? buf.readDoubleBE(0) : buf.readDoubleLE(0));
        break;
      default:
        throw new Error(`Unsupported dtype: ${dtype}`);
    }
  }
  return out;
}

// For writing: write number into buffer with byteorder, then split to 2-byte words,
// apply wordorder, then convert each pair to a 16-bit register value.
function encodeTyped(values: any[], dtype: string, byteorder: "big" | "little", wordorder: "big" | "little"): number[] {
  const outRegs: number[] = [];
  for (const v of values) {
    let buf: Buffer;
    switch (dtype) {
      case "int16":
        buf = Buffer.alloc(2);
        byteorder === "big" ? buf.writeInt16BE(Number(v), 0) : buf.writeInt16LE(Number(v), 0);
        break;
      case "uint16":
        buf = Buffer.alloc(2);
        byteorder === "big" ? buf.writeUInt16BE(Number(v), 0) : buf.writeUInt16LE(Number(v), 0);
        break;
      case "int32":
        buf = Buffer.alloc(4);
        byteorder === "big" ? buf.writeInt32BE(Number(v), 0) : buf.writeInt32LE(Number(v), 0);
        break;
      case "uint32":
        buf = Buffer.alloc(4);
        byteorder === "big" ? buf.writeUInt32BE(Number(v), 0) : buf.writeUInt32LE(Number(v), 0);
        break;
      case "float32":
        buf = Buffer.alloc(4);
        byteorder === "big" ? buf.writeFloatBE(Number(v), 0) : buf.writeFloatLE(Number(v), 0);
        break;
      case "int64": {
        buf = Buffer.alloc(8);
        const big = BigInt(v);
        const hi = Number((big >> 32n) & 0xffffffffn);
        const lo = Number(big & 0xffffffffn);
        if (byteorder === "big") {
          buf.writeInt32BE(hi, 0); buf.writeUInt32BE(lo, 4);
        } else {
          buf.writeUInt32LE(lo, 0); buf.writeInt32LE(hi, 4);
        }
        break;
      }
      case "uint64": {
        buf = Buffer.alloc(8);
        const big = BigInt(v);
        const hi = Number((big >> 32n) & 0xffffffffn);
        const lo = Number(big & 0xffffffffn);
        if (byteorder === "big") {
          buf.writeUInt32BE(hi, 0); buf.writeUInt32BE(lo, 4);
        } else {
          buf.writeUInt32LE(lo, 0); buf.writeUInt32LE(hi, 4);
        }
        break;
      }
      case "float64":
        buf = Buffer.alloc(8);
        byteorder === "big" ? buf.writeDoubleBE(Number(v), 0) : buf.writeDoubleLE(Number(v), 0);
        break;
      default:
        throw new Error(`Unsupported dtype: ${dtype}`);
    }
    const pairs = toPairs([...buf]);
    const ordered = wordorder === "little" ? pairs.slice().reverse() : pairs;
    for (const [b0, b1] of ordered) {
      outRegs.push(((b0 & 0xff) << 8) | (b1 & 0xff));
    }
  }
  return outRegs;
}

function normalizeTable(val: string): "holding" | "input" | "coil" | "discrete" | string {
  const v = String(val).toLowerCase();
  if (["holding", "hr", "register", "holding_register"].includes(v)) return "holding";
  if (["input", "ir", "input_register", "inputs"].includes(v)) return "input";
  if (["coil", "coils"].includes(v)) return "coil";
  if (["discrete", "di", "discrete_input", "discrete_inputs"].includes(v)) return "discrete";
  return v;
}

// -----------------------------
// Server class
// -----------------------------

// modbus-serial is CJS; adapt to ESM import
const ModbusRTU: any = (ModbusSerialPkg as any).default || (ModbusSerialPkg as any);

class ModbusMCPServer {
  private server: Server;
  private client: any | null = null;

  constructor() {
    this.server = new Server(
      { name: "modbus-mcp-npx-server", version: "0.1.0" },
      { capabilities: { tools: {} } }
    );

    this.setupToolHandlers();
    this.setupLifecycle();
  }

  private setupLifecycle() {
    process.on("SIGINT", async () => { await this.disconnect(); process.exit(0); });
    process.on("SIGTERM", async () => { await this.disconnect(); process.exit(0); });
  }

  private async connect(): Promise<void> {
    if (this.client) return;
    const c = new ModbusRTU();
    c.setTimeout(Math.max(1, Math.round(MODBUS_TIMEOUT * 1000)));

    if (MODBUS_TYPE === "tcp") {
      await c.connectTCP(MODBUS_HOST, { port: MODBUS_PORT });
    } else if (MODBUS_TYPE === "udp") {
      // UDP: library supports connectUDP(host, options)
      await c.connectUDP(MODBUS_HOST, { port: MODBUS_PORT });
    } else if (MODBUS_TYPE === "serial") {
      await c.connectRTUBuffered(MODBUS_SERIAL_PORT, {
        baudRate: MODBUS_BAUDRATE,
        parity: MODBUS_PARITY as any,
        stopBits: MODBUS_STOPBITS as any,
        dataBits: MODBUS_BYTESIZE as any,
      });
    } else {
      throw new Error(`Invalid MODBUS_TYPE: ${MODBUS_TYPE}`);
    }
    this.client = c;
  }

  private async disconnect(): Promise<void> {
    try {
      if (this.client) {
        try { (this.client as any).close && (this.client as any).close(); } catch {}
        this.client = null;
      }
    } catch (e) {
      // ignore disconnect errors
    }
  }

  private async ensureConnection(): Promise<void> {
    if (!this.client) await this.connect();
  }

  private setUnitId(id?: number) {
    const cid = id ?? MODBUS_DEFAULT_SLAVE_ID;
    this.client!.setID(cid);
  }

  // -----------------------------
  // Tools
  // -----------------------------

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          { name: "read_register", description: "Read a single holding register", inputSchema: { type: "object", properties: { address: { type: "number" }, slave_id: { type: "number" } }, required: ["address"] } },
          { name: "write_register", description: "Write a single holding register", inputSchema: { type: "object", properties: { address: { type: "number" }, value: { type: "number" }, slave_id: { type: "number" } }, required: ["address", "value"] } },
          { name: "read_coils", description: "Read coils (FC1)", inputSchema: { type: "object", properties: { address: { type: "number" }, count: { type: "number" }, slave_id: { type: "number" } }, required: ["address", "count"] } },
          { name: "write_coil", description: "Write a single coil (FC5)", inputSchema: { type: "object", properties: { address: { type: "number" }, value: { type: "boolean" }, slave_id: { type: "number" } }, required: ["address", "value"] } },
          { name: "read_input_registers", description: "Read input registers (FC4)", inputSchema: { type: "object", properties: { address: { type: "number" }, count: { type: "number" }, slave_id: { type: "number" } }, required: ["address", "count"] } },
          { name: "read_multiple_holding_registers", description: "Read holding registers (FC3)", inputSchema: { type: "object", properties: { address: { type: "number" }, count: { type: "number" }, slave_id: { type: "number" } }, required: ["address", "count"] } },
          { name: "read_discrete_inputs", description: "Read discrete inputs (FC2)", inputSchema: { type: "object", properties: { address: { type: "number" }, count: { type: "number" }, slave_id: { type: "number" } }, required: ["address", "count"] } },
          { name: "write_registers", description: "Write multiple holding registers (FC16)", inputSchema: { type: "object", properties: { address: { type: "number" }, values: { type: "array", items: { type: "number" } }, slave_id: { type: "number" } }, required: ["address", "values"] } },
          { name: "write_coils_bulk", description: "Write multiple coils (FC15)", inputSchema: { type: "object", properties: { address: { type: "number" }, values: { type: "array", items: { type: "boolean" } }, slave_id: { type: "number" } }, required: ["address", "values"] } },
          { name: "mask_write_register", description: "Mask write register (FC22)", inputSchema: { type: "object", properties: { address: { type: "number" }, and_mask: { type: "number" }, or_mask: { type: "number" }, slave_id: { type: "number" } }, required: ["address", "and_mask", "or_mask"] } },
          { name: "read_device_information", description: "Read device identification (MEI 0x2B/0x0E)", inputSchema: { type: "object", properties: { slave_id: { type: "number" }, read_code: { type: "number" }, object_id: { type: "number" } }, required: [] } },
          { name: "read_holding_typed", description: "Read holding registers decoded as typed values", inputSchema: { type: "object", properties: { address: { type: "number" }, dtype: { type: "string" }, count: { type: "number" }, byteorder: { type: "string" }, wordorder: { type: "string" }, scale: { type: "number" }, offset: { type: "number" }, slave_id: { type: "number" } }, required: ["address", "dtype"] } },
          { name: "read_input_typed", description: "Read input registers decoded as typed values", inputSchema: { type: "object", properties: { address: { type: "number" }, dtype: { type: "string" }, count: { type: "number" }, byteorder: { type: "string" }, wordorder: { type: "string" }, scale: { type: "number" }, offset: { type: "number" }, slave_id: { type: "number" } }, required: ["address", "dtype"] } },
          { name: "list_tags", description: "List tags from REGISTER_MAP_FILE", inputSchema: { type: "object", properties: {} } },
          { name: "read_tag", description: "Read a tag defined in tag map", inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
          { name: "write_tag", description: "Write a tag defined in tag map", inputSchema: { type: "object", properties: { name: { type: "string" }, value: {} }, required: ["name", "value"] } },
          { name: "ping", description: "Server health and connection status", inputSchema: { type: "object", properties: {} } },
        ] satisfies Tool[]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        await this.ensureConnection();
        switch (name) {
          case "read_register": return await this.handleReadRegister(args);
          case "write_register": return await this.handleWriteRegister(args);
          case "read_coils": return await this.handleReadCoils(args);
          case "write_coil": return await this.handleWriteCoil(args);
          case "read_input_registers": return await this.handleReadInputRegisters(args);
          case "read_multiple_holding_registers": return await this.handleReadHoldingRegisters(args);
          case "read_discrete_inputs": return await this.handleReadDiscreteInputs(args);
          case "write_registers": return await this.handleWriteRegisters(args);
          case "write_coils_bulk": return await this.handleWriteCoils(args);
          case "mask_write_register": return await this.handleMaskWriteRegister(args);
          case "read_device_information": return await this.handleReadDeviceInformation(args);
          case "read_holding_typed": return await this.handleReadHoldingTyped(args);
          case "read_input_typed": return await this.handleReadInputTyped(args);
          case "list_tags": return this.wrap(makeResult(true, { tags: Object.entries(TAG_MAP).map(([name, spec]) => ({ name, ...(spec as any) })) }));
          case "read_tag": return await this.handleReadTag(args);
          case "write_tag": return await this.handleWriteTag(args);
          case "ping": return this.wrap(makeResult(true, { connected: !!this.client, type: MODBUS_TYPE, host: MODBUS_TYPE !== "serial" ? MODBUS_HOST : undefined, port: MODBUS_TYPE !== "serial" ? MODBUS_PORT : undefined, serial_port: MODBUS_TYPE === "serial" ? MODBUS_SERIAL_PORT : undefined, writes_enabled: MODBUS_WRITES_ENABLED, max_retries: MODBUS_MAX_RETRIES, tool_timeout: MODBUS_TOOL_TIMEOUT, tag_count: Object.keys(TAG_MAP).length }));
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        return this.wrap(makeResult(false, undefined, error?.message || String(error)));
      }
    });
  }

  private wrap(result: ToolResult) {
    return { content: [{ type: "json", json: result }] };
  }

  private async handleReadRegister(args: any) {
    const address = Number(args?.address);
    const slaveId = args?.slave_id ? Number(args?.slave_id) : MODBUS_DEFAULT_SLAVE_ID;
    this.setUnitId(slaveId);
    const { result, error, durationMs, attempts } = await retryCall("read_register", async () => {
      const res = await this.client!.readHoldingRegisters(address, 1);
      return Array.isArray((res as any).data) ? (res as any).data[0] : (res as any).data?.[0];
    }, MODBUS_MAX_RETRIES, MODBUS_TOOL_TIMEOUT);
    if (error) return this.wrap(makeResult(false, undefined, error, { address, slave_id: slaveId, duration_ms: Math.round(durationMs * 1000) / 1000, attempts }));
    return this.wrap(makeResult(true, { value: result }, null, { address, slave_id: slaveId, duration_ms: Math.round(durationMs * 1000) / 1000, attempts }));
  }

  private async handleWriteRegister(args: any) {
    if (!MODBUS_WRITES_ENABLED) return this.wrap(makeResult(false, undefined, "Writes are disabled by configuration"));
    const address = Number(args?.address);
    const value = Number(args?.value);
    const slaveId = args?.slave_id ? Number(args?.slave_id) : MODBUS_DEFAULT_SLAVE_ID;
    this.setUnitId(slaveId);
    const { error, durationMs, attempts } = await retryCall("write_register", async () => {
      return await this.client!.writeRegister(address, value);
    }, MODBUS_MAX_RETRIES, MODBUS_TOOL_TIMEOUT);
    if (error) return this.wrap(makeResult(false, undefined, error, { address, value, slave_id: slaveId, duration_ms: Math.round(durationMs * 1000) / 1000, attempts }));
    return this.wrap(makeResult(true, { written: value }, null, { address, slave_id: slaveId, duration_ms: Math.round(durationMs * 1000) / 1000, attempts }));
  }

  private async handleReadCoils(args: any) {
    const address = Number(args?.address);
    const count = Number(args?.count);
    const slaveId = args?.slave_id ? Number(args?.slave_id) : MODBUS_DEFAULT_SLAVE_ID;
    this.setUnitId(slaveId);
    const r = await chunkedRead(
      "read_coils",
      async (start, size) => await this.client!.readCoils(start, size),
      address,
      count,
      2000,
      (res) => (res as any).data,
      MODBUS_TOOL_TIMEOUT
    );
    if (r.error) return this.wrap(makeResult(false, undefined, r.error, { address, count, slave_id: slaveId, ...(r.meta || {}) }));
    return this.wrap(makeResult(true, { values: r.values }, null, { address, count, slave_id: slaveId, ...(r.meta || {}) }));
  }

  private async handleWriteCoil(args: any) {
    if (!MODBUS_WRITES_ENABLED) return this.wrap(makeResult(false, undefined, "Writes are disabled by configuration"));
    const address = Number(args?.address);
    const value = Boolean(args?.value);
    const slaveId = args?.slave_id ? Number(args?.slave_id) : MODBUS_DEFAULT_SLAVE_ID;
    this.setUnitId(slaveId);
    const { error, durationMs, attempts } = await retryCall("write_coil", async () => await this.client!.writeCoil(address, value), MODBUS_MAX_RETRIES, MODBUS_TOOL_TIMEOUT);
    if (error) return this.wrap(makeResult(false, undefined, error, { address, value, slave_id: slaveId, duration_ms: Math.round(durationMs * 1000) / 1000, attempts }));
    return this.wrap(makeResult(true, { written: value }, null, { address, slave_id: slaveId, duration_ms: Math.round(durationMs * 1000) / 1000, attempts }));
  }

  private async handleReadInputRegisters(args: any) {
    const address = Number(args?.address);
    const count = Number(args?.count);
    const slaveId = args?.slave_id ? Number(args?.slave_id) : MODBUS_DEFAULT_SLAVE_ID;
    this.setUnitId(slaveId);
    const r = await chunkedRead(
      "read_input_registers",
      async (start, size) => await this.client!.readInputRegisters(start, size),
      address,
      count,
      125,
      (res) => (res as any).data,
      MODBUS_TOOL_TIMEOUT
    );
    if (r.error) return this.wrap(makeResult(false, undefined, r.error, { address, count, slave_id: slaveId, ...(r.meta || {}) }));
    return this.wrap(makeResult(true, { registers: r.values }, null, { address, count, slave_id: slaveId, ...(r.meta || {}) }));
  }

  private async handleReadHoldingRegisters(args: any) {
    const address = Number(args?.address);
    const count = Number(args?.count);
    const slaveId = args?.slave_id ? Number(args?.slave_id) : MODBUS_DEFAULT_SLAVE_ID;
    this.setUnitId(slaveId);
    const r = await chunkedRead(
      "read_holding_registers",
      async (start, size) => await this.client!.readHoldingRegisters(start, size),
      address,
      count,
      125,
      (res) => (res as any).data,
      MODBUS_TOOL_TIMEOUT
    );
    if (r.error) return this.wrap(makeResult(false, undefined, r.error, { address, count, slave_id: slaveId, ...(r.meta || {}) }));
    return this.wrap(makeResult(true, { registers: r.values }, null, { address, count, slave_id: slaveId, ...(r.meta || {}) }));
  }

  private async handleReadDiscreteInputs(args: any) {
    const address = Number(args?.address);
    const count = Number(args?.count);
    const slaveId = args?.slave_id ? Number(args?.slave_id) : MODBUS_DEFAULT_SLAVE_ID;
    this.setUnitId(slaveId);
    const r = await chunkedRead(
      "read_discrete_inputs",
      async (start, size) => await this.client!.readDiscreteInputs(start, size),
      address,
      count,
      2000,
      (res) => (res as any).data,
      MODBUS_TOOL_TIMEOUT
    );
    if (r.error) return this.wrap(makeResult(false, undefined, r.error, { address, count, slave_id: slaveId, ...(r.meta || {}) }));
    return this.wrap(makeResult(true, { values: r.values }, null, { address, count, slave_id: slaveId, ...(r.meta || {}) }));
  }

  private async handleWriteRegisters(args: any) {
    if (!MODBUS_WRITES_ENABLED) return this.wrap(makeResult(false, undefined, "Writes are disabled by configuration"));
    const address = Number(args?.address);
    const values = Array.isArray(args?.values) ? (args.values as any[]).map((n) => Number(n)) : [];
    if (values.length === 0) return this.wrap(makeResult(false, undefined, "Values list must not be empty"));
    const slaveId = args?.slave_id ? Number(args?.slave_id) : MODBUS_DEFAULT_SLAVE_ID;
    this.setUnitId(slaveId);
    const { error, durationMs, attempts } = await retryCall("write_registers", async () => await this.client!.writeRegisters(address, values), MODBUS_MAX_RETRIES, MODBUS_TOOL_TIMEOUT);
    if (error) return this.wrap(makeResult(false, undefined, error, { address, count: values.length, slave_id: slaveId, duration_ms: Math.round(durationMs * 1000) / 1000, attempts }));
    return this.wrap(makeResult(true, { written: values.length }, null, { address, slave_id: slaveId, duration_ms: Math.round(durationMs * 1000) / 1000, attempts }));
  }

  private async handleWriteCoils(args: any) {
    if (!MODBUS_WRITES_ENABLED) return this.wrap(makeResult(false, undefined, "Writes are disabled by configuration"));
    const address = Number(args?.address);
    const values = Array.isArray(args?.values) ? (args.values as any[]).map((b) => Boolean(b)) : [];
    if (values.length === 0) return this.wrap(makeResult(false, undefined, "Values list must not be empty"));
    const slaveId = args?.slave_id ? Number(args?.slave_id) : MODBUS_DEFAULT_SLAVE_ID;
    this.setUnitId(slaveId);
    const { error, durationMs, attempts } = await retryCall("write_coils", async () => await this.client!.writeCoils(address, values), MODBUS_MAX_RETRIES, MODBUS_TOOL_TIMEOUT);
    if (error) return this.wrap(makeResult(false, undefined, error, { address, count: values.length, slave_id: slaveId, duration_ms: Math.round(durationMs * 1000) / 1000, attempts }));
    return this.wrap(makeResult(true, { written: values.length }, null, { address, slave_id: slaveId, duration_ms: Math.round(durationMs * 1000) / 1000, attempts }));
  }

  private async handleMaskWriteRegister(args: any) {
    if (!MODBUS_WRITES_ENABLED) return this.wrap(makeResult(false, undefined, "Writes are disabled by configuration"));
    const address = Number(args?.address);
    const andMask = Number(args?.and_mask);
    const orMask = Number(args?.or_mask);
    const slaveId = args?.slave_id ? Number(args?.slave_id) : MODBUS_DEFAULT_SLAVE_ID;
    this.setUnitId(slaveId);
    const { error, durationMs, attempts } = await retryCall("mask_write_register", async () => await (this.client as any).maskWriteRegister(address, andMask, orMask), MODBUS_MAX_RETRIES, MODBUS_TOOL_TIMEOUT);
    if (error) return this.wrap(makeResult(false, undefined, error, { address, and_mask: andMask, or_mask: orMask, slave_id: slaveId, duration_ms: Math.round(durationMs * 1000) / 1000, attempts }));
    return this.wrap(makeResult(true, { address, and_mask: andMask, or_mask: orMask }, null, { slave_id: slaveId, duration_ms: Math.round(durationMs * 1000) / 1000, attempts }));
  }

  private async handleReadDeviceInformation(args: any) {
    const slaveId = args?.slave_id ? Number(args?.slave_id) : MODBUS_DEFAULT_SLAVE_ID;
    const readCode = args?.read_code ? Number(args?.read_code) : 0x03; // extended
    const objectId = args?.object_id ? Number(args?.object_id) : 0x00;
    this.setUnitId(slaveId);
    const { result, error, durationMs, attempts } = await retryCall("read_device_information", async () => await (this.client as any).readDeviceIdentification(readCode, objectId), MODBUS_MAX_RETRIES, MODBUS_TOOL_TIMEOUT);
    if (error) return this.wrap(makeResult(false, undefined, error, { slave_id: slaveId, duration_ms: Math.round(durationMs * 1000) / 1000, attempts }));
    // Attempt to normalize
    const data: Record<string, any> = {};
    if (result && typeof result === 'object') {
      for (const k of ["information", "informations", "items", "values", "data"]) {
        const v = (result as any)[k];
        if (v && typeof v === 'object') { Object.assign(data, v); break; }
      }
    }
    return this.wrap(makeResult(true, data, null, { slave_id: slaveId, duration_ms: Math.round(durationMs * 1000) / 1000, attempts }));
  }

  private async handleReadHoldingTyped(args: any) {
    const address = Number(args?.address);
    const dtype = String(args?.dtype);
    const count = args?.count ? Number(args?.count) : 1;
    const byteorder = (args?.byteorder || "big").toString().toLowerCase() === "little" ? "little" : "big";
    const wordorder = (args?.wordorder || "big").toString().toLowerCase() === "little" ? "little" : "big";
    const scale = args?.scale ? Number(args?.scale) : 1.0;
    const offset = args?.offset ? Number(args?.offset) : 0.0;
    const slaveId = args?.slave_id ? Number(args?.slave_id) : MODBUS_DEFAULT_SLAVE_ID;
    const sizeRegs = DTYPE_SIZES[dtype];
    if (!sizeRegs) return this.wrap(makeResult(false, undefined, `Unsupported dtype: ${dtype}`));
    this.setUnitId(slaveId);
    const totalRegs = sizeRegs * Math.max(1, count);
    const r = await chunkedRead(
      "read_holding_registers",
      async (start, size) => await this.client!.readHoldingRegisters(start, size),
      address,
      totalRegs,
      125,
      (res) => (res as any).data,
      MODBUS_TOOL_TIMEOUT
    );
    if (r.error) return this.wrap(makeResult(false, undefined, r.error, { address, count, dtype, slave_id: slaveId, ...(r.meta || {}) }));
    try {
      const vals = decodeTyped(r.values || [], dtype, count, byteorder, wordorder).map((v) => v * Number(scale) + Number(offset));
      return this.wrap(makeResult(true, { values: vals }, null, { address, count, dtype, byteorder, wordorder, scale, offset, slave_id: slaveId, ...(r.meta || {}) }));
    } catch (e: any) {
      return this.wrap(makeResult(false, undefined, e?.message || String(e), { address, count, dtype, slave_id: slaveId }));
    }
  }

  private async handleReadInputTyped(args: any) {
    const address = Number(args?.address);
    const dtype = String(args?.dtype);
    const count = args?.count ? Number(args?.count) : 1;
    const byteorder = (args?.byteorder || "big").toString().toLowerCase() === "little" ? "little" : "big";
    const wordorder = (args?.wordorder || "big").toString().toLowerCase() === "little" ? "little" : "big";
    const scale = args?.scale ? Number(args?.scale) : 1.0;
    const offset = args?.offset ? Number(args?.offset) : 0.0;
    const slaveId = args?.slave_id ? Number(args?.slave_id) : MODBUS_DEFAULT_SLAVE_ID;
    const sizeRegs = DTYPE_SIZES[dtype];
    if (!sizeRegs) return this.wrap(makeResult(false, undefined, `Unsupported dtype: ${dtype}`));
    this.setUnitId(slaveId);
    const totalRegs = sizeRegs * Math.max(1, count);
    const r = await chunkedRead(
      "read_input_registers",
      async (start, size) => await this.client!.readInputRegisters(start, size),
      address,
      totalRegs,
      125,
      (res) => (res as any).data,
      MODBUS_TOOL_TIMEOUT
    );
    if (r.error) return this.wrap(makeResult(false, undefined, r.error, { address, count, dtype, slave_id: slaveId, ...(r.meta || {}) }));
    try {
      const vals = decodeTyped(r.values || [], dtype, count, byteorder, wordorder).map((v) => v * Number(scale) + Number(offset));
      return this.wrap(makeResult(true, { values: vals }, null, { address, count, dtype, byteorder, wordorder, scale, offset, slave_id: slaveId, ...(r.meta || {}) }));
    } catch (e: any) {
      return this.wrap(makeResult(false, undefined, e?.message || String(e), { address, count, dtype, slave_id: slaveId }));
    }
  }

  private async handleReadTag(args: any) {
    const name = String(args?.name);
    const spec = TAG_MAP[name];
    if (!spec) return this.wrap(makeResult(false, undefined, `Unknown tag: ${name}`));
    const table = normalizeTable(spec.table || "holding");
    const addr = Number(spec.address || 0);
    const count = Number(spec.count || 1);
    const slaveId = Number(spec.slave_id || MODBUS_DEFAULT_SLAVE_ID);
    const dtype = spec.dtype as string | undefined;
    const byteorder = String(spec.byteorder || "big").toLowerCase();
    const wordorder = String(spec.wordorder || "big").toLowerCase();
    const scale = Number(spec.scale || 1.0);
    const offset = Number(spec.offset || 0.0);
    if ((table === "holding" || table === "input") && dtype) {
      if (table === "holding") return await this.handleReadHoldingTyped({ address: addr, dtype, count, byteorder, wordorder, scale, offset, slave_id: slaveId });
      else return await this.handleReadInputTyped({ address: addr, dtype, count, byteorder, wordorder, scale, offset, slave_id: slaveId });
    }
    if (table === "holding") return await this.handleReadHoldingRegisters({ address: addr, count, slave_id: slaveId });
    if (table === "input") return await this.handleReadInputRegisters({ address: addr, count, slave_id: slaveId });
    if (table === "coil") return await this.handleReadCoils({ address: addr, count, slave_id: slaveId });
    if (table === "discrete") return await this.handleReadDiscreteInputs({ address: addr, count, slave_id: slaveId });
    return this.wrap(makeResult(false, undefined, `Unsupported table: ${table}`));
  }

  private async handleWriteTag(args: any) {
    if (!MODBUS_WRITES_ENABLED) return this.wrap(makeResult(false, undefined, "Writes are disabled by configuration"));
    const name = String(args?.name);
    const value = args?.value;
    const spec = TAG_MAP[name];
    if (!spec) return this.wrap(makeResult(false, undefined, `Unknown tag: ${name}`));
    const table = normalizeTable(spec.table || "holding");
    const addr = Number(spec.address || 0);
    const slaveId = Number(spec.slave_id || MODBUS_DEFAULT_SLAVE_ID);
    if (table === "coil") return await this.handleWriteCoil({ address: addr, value: Boolean(value), slave_id: slaveId });
    if (table === "holding") {
      const dtype = String(spec.dtype || "uint16").toLowerCase();
      const byteorder = String(spec.byteorder || "big").toLowerCase() as "big" | "little";
      const wordorder = String(spec.wordorder || "big").toLowerCase() as "big" | "little";
      const vals = Array.isArray(value) ? (value as any[]) : [value];
      try {
        const regs = encodeTyped(vals, dtype, byteorder, wordorder);
        return await this.handleWriteRegisters({ address: addr, values: regs, slave_id: slaveId });
      } catch (e: any) {
        return this.wrap(makeResult(false, undefined, e?.message || String(e)));
      }
    }
    return this.wrap(makeResult(false, undefined, `Unsupported/writable table for tag '${name}': ${table}`));
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Modbus MCP Server running on stdio");
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = new ModbusMCPServer();
server.run().catch((e) => { console.error(e); process.exit(1); });
