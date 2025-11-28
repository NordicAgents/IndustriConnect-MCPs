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
import { Controller, Tag } from "ethernet-ip";

dotenv.config();

type ToolResult = {
  success: boolean;
  data?: any;
  error?: string | null;
  meta?: Record<string, any>;
};

const TRUE_SET = new Set(["1", "true", "t", "yes", "y", "on"]);

interface EnvConfig {
  host: string;
  slot: number;
  port: number;
  timeout: number;
  writesEnabled: boolean;
  systemCmdsEnabled: boolean;
  tagMapFile?: string;
}

function boolFromEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return TRUE_SET.has(value.trim().toLowerCase());
}

function loadEnv(): EnvConfig {
  return {
    host: process.env.ENIP_HOST || "127.0.0.1",
    slot: parseInt(process.env.ENIP_SLOT || "0", 10),
    port: parseInt(process.env.ENIP_PORT || "44818", 10),
    timeout: parseFloat(process.env.ENIP_TIMEOUT || "10"),
    writesEnabled: boolFromEnv(process.env.ENIP_WRITES_ENABLED, true),
    systemCmdsEnabled: boolFromEnv(process.env.ENIP_SYSTEM_CMDS_ENABLED, false),
    tagMapFile: process.env.TAG_MAP_FILE,
  };
}

function makeResult(success: boolean, data?: any, error?: string | null, meta?: Record<string, any>): ToolResult {
  return { success, data, error: error ?? null, meta: meta || {} };
}

class EIPControllerWrapper {
  private controller = new Controller();
  private connected = false;

  constructor(private readonly config: EnvConfig) {}

  async ensureConnected(force = false): Promise<void> {
    if (this.connected && !force) return;
    await this.controller.connect(this.config.host, this.config.slot);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    try {
      await this.controller.disconnect();
    } catch {
      /* ignore */
    } finally {
      this.connected = false;
    }
  }

  async readTag(tagName: string, elements?: number): Promise<{ tag: Tag; durationMs: number }> {
    await this.ensureConnected();
    const tag = new Tag(tagName, null, elements);
    const start = performance.now();
    await this.controller.readTag(tag);
    return { tag, durationMs: performance.now() - start };
  }

  async writeTag(tagName: string, value: any, elements?: number): Promise<{ durationMs: number }> {
    await this.ensureConnected();
    const tag = new Tag(tagName, null, elements);
    tag.value = value;
    const start = performance.now();
    await this.controller.writeTag(tag);
    return { durationMs: performance.now() - start };
  }

  async readMultiple(tags: string[]): Promise<{ results: Array<{ name: string; value: any }>; durationMs: number }> {
    const start = performance.now();
    const out: Array<{ name: string; value: any }> = [];
    for (const name of tags) {
      const { tag } = await this.readTag(name);
      out.push({ name, value: tag.value });
    }
    return { results: out, durationMs: performance.now() - start };
  }

  async writeMultiple(entries: Array<{ name: string; value: any }>): Promise<{ durationMs: number }> {
    const start = performance.now();
    for (const entry of entries) {
      await this.writeTag(entry.name, entry.value);
    }
    return { durationMs: performance.now() - start };
  }

  connectionMeta(): Record<string, any> {
    return {
      connected: this.connected,
      host: this.config.host,
      slot: this.config.slot,
      port: this.config.port,
    };
  }
}

class TagMap {
  private tags: Record<string, any> = {};
  private mtime: number | undefined;

  constructor(private readonly path?: string) {
    this.load();
  }

  private load(): void {
    if (!this.path) {
      this.tags = {};
      this.mtime = undefined;
      return;
    }
    try {
      const stat = fs.statSync(this.path);
      if (this.mtime && this.mtime >= stat.mtimeMs) return;
      const raw = fs.readFileSync(this.path, "utf-8");
      const json = JSON.parse(raw);
      if (typeof json === "object" && json) {
        this.tags = json as Record<string, any>;
        this.mtime = stat.mtimeMs;
      }
    } catch {
      this.tags = {};
      this.mtime = undefined;
    }
  }

  get(alias: string): any | undefined {
    this.load();
    return this.tags[alias];
  }

  list(): Array<{ alias: string; tag?: string; description?: string }> {
    this.load();
    return Object.entries(this.tags).map(([alias, spec]) => ({
      alias,
      tag: (spec as any)?.tag,
      description: (spec as any)?.description,
    }));
  }

  count(): number {
    this.load();
    return Object.keys(this.tags).length;
  }
}

function serializeTag(tag: Tag): Record<string, any> {
  return {
    tag: tag.name,
    value: tag.value,
    data_type: tag.type,
  };
}

function applyScaling(value: any, spec: any, direction: "to_eng" | "to_raw"): any {
  const scaling = spec?.scaling;
  if (!scaling) return value;

  const convert = (val: any): any => {
    const num = Number(val);
    if (Number.isNaN(num)) return val;
    const rawMin = Number(scaling.raw_min ?? 0);
    const rawMax = Number(scaling.raw_max ?? 1);
    const engMin = Number(scaling.eng_min ?? rawMin);
    const engMax = Number(scaling.eng_max ?? rawMax);
    if (direction === "to_eng") {
      const span = rawMax - rawMin || 1;
      const ratio = (num - rawMin) / span;
      return engMin + ratio * (engMax - engMin);
    }
    const span = engMax - engMin || 1;
    const ratio = (num - engMin) / span;
    return rawMin + ratio * (rawMax - rawMin);
  };

  if (Array.isArray(value)) {
    return value.map((v) => convert(v));
  }
  return convert(value);
}

class EtherNetIPMCPServer {
  private readonly server = new Server({ name: "EtherNet/IP MCP (Node)" });
  private readonly tools: Tool[];
  private readonly controller: EIPControllerWrapper;
  private readonly tagMap: TagMap;

  constructor(private readonly config: EnvConfig) {
    this.controller = new EIPControllerWrapper(config);
    this.tagMap = new TagMap(config.tagMapFile);
    this.tools = [
      {
        name: "read_tag",
        description: "Read an EtherNet/IP tag.",
        inputSchema: {
          type: "object",
          properties: {
            tag_name: { type: "string" },
            elements: { type: "integer" }
          },
          required: ["tag_name"]
        }
      },
      {
        name: "write_tag",
        description: "Write an EtherNet/IP tag.",
        inputSchema: {
          type: "object",
          properties: {
            tag_name: { type: "string" },
            value: {},
            elements: { type: "integer" }
          },
          required: ["tag_name", "value"]
        }
      },
      {
        name: "read_array",
        description: "Read array values from a tag.",
        inputSchema: {
          type: "object",
          properties: {
            tag_name: { type: "string" },
            elements: { type: "integer" }
          },
          required: ["tag_name", "elements"]
        }
      },
      {
        name: "write_array",
        description: "Write array values into a tag.",
        inputSchema: {
          type: "object",
          properties: {
            tag_name: { type: "string" },
            values: { type: "array", items: {} }
          },
          required: ["tag_name", "values"]
        }
      },
      {
        name: "read_string",
        description: "Read a STRING tag.",
        inputSchema: {
          type: "object",
          properties: { tag_name: { type: "string" } },
          required: ["tag_name"]
        }
      },
      {
        name: "write_string",
        description: "Write a STRING tag.",
        inputSchema: {
          type: "object",
          properties: { tag_name: { type: "string" }, value: { type: "string" } },
          required: ["tag_name", "value"]
        }
      },
      {
        name: "get_tag_list",
        description: "Enumerate controller tags (placeholder).",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "read_multiple_tags",
        description: "Batch read multiple tags.",
        inputSchema: {
          type: "object",
          properties: { tags: { type: "array", items: { type: "string" } } },
          required: ["tags"]
        }
      },
      {
        name: "write_multiple_tags",
        description: "Batch write multiple tags.",
        inputSchema: {
          type: "object",
          properties: {
            payloads: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  tag_name: { type: "string" },
                  value: {}
                },
                required: ["tag_name", "value"]
              }
            }
          },
          required: ["payloads"]
        }
      },
      {
        name: "list_tags",
        description: "List tag aliases from the tag map.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "read_tag_by_alias",
        description: "Read a tag using a tag-map alias.",
        inputSchema: {
          type: "object",
          properties: { alias: { type: "string" } },
          required: ["alias"]
        }
      },
      {
        name: "write_tag_by_alias",
        description: "Write a tag using a tag-map alias.",
        inputSchema: {
          type: "object",
          properties: {
            alias: { type: "string" },
            value: {}
          },
          required: ["alias", "value"]
        }
      },
      {
        name: "ping",
        description: "Return health/status info.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "get_connection_status",
        description: "Return connection metadata.",
        inputSchema: { type: "object", properties: {} }
      }
    ];

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: this.tools }));
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const name = request.params.name;
      const args = request.params.arguments || {};
      switch (name) {
        case "read_tag":
          return { content: [{ type: "application/json", data: await this.handleReadTag(args) }] };
        case "write_tag":
          return { content: [{ type: "application/json", data: await this.handleWriteTag(args) }] };
        case "read_array":
          return { content: [{ type: "application/json", data: await this.handleReadArray(args) }] };
        case "write_array":
          return { content: [{ type: "application/json", data: await this.handleWriteArray(args) }] };
        case "read_string":
          return { content: [{ type: "application/json", data: await this.handleReadString(args) }] };
        case "write_string":
          return { content: [{ type: "application/json", data: await this.handleWriteString(args) }] };
        case "get_tag_list":
          return { content: [{ type: "application/json", data: await this.handleGetTagList() }] };
        case "read_multiple_tags":
          return { content: [{ type: "application/json", data: await this.handleReadMultipleTags(args) }] };
        case "write_multiple_tags":
          return { content: [{ type: "application/json", data: await this.handleWriteMultipleTags(args) }] };
        case "list_tags":
          return { content: [{ type: "application/json", data: await this.handleListTags() }] };
        case "read_tag_by_alias":
          return { content: [{ type: "application/json", data: await this.handleReadAlias(args) }] };
        case "write_tag_by_alias":
          return { content: [{ type: "application/json", data: await this.handleWriteAlias(args) }] };
        case "ping":
          return { content: [{ type: "application/json", data: await this.handlePing() }] };
        case "get_connection_status":
          return { content: [{ type: "application/json", data: await this.handleConnectionStatus() }] };
        default:
          return { content: [{ type: "application/json", data: makeResult(false, undefined, `Unknown tool: ${name}`) }] };
      }
    });
  }

  async run(): Promise<void> {
    await this.controller.ensureConnected().catch(() => {
      // connection will be re-attempted lazily by first tool call
    });
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("EtherNet/IP MCP (Node) listening on stdio");
  }

  async shutdown(): Promise<void> {
    await this.controller.disconnect();
  }

  private ensureWritesAllowed(tool: string): ToolResult | undefined {
    if (!this.config.writesEnabled) {
      return makeResult(false, undefined, "Write operations are disabled by configuration", { tool });
    }
    return undefined;
  }

  private async handleReadTag(args: any): Promise<ToolResult> {
    const tagName = String(args?.tag_name || "");
    const elements = args?.elements !== undefined ? Number(args.elements) : undefined;
    try {
      const { tag, durationMs } = await this.controller.readTag(tagName, elements);
      return makeResult(true, { result: serializeTag(tag) }, null, {
        tag_name: tagName,
        elements,
        duration_ms: Number(durationMs.toFixed(3))
      });
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { tag_name: tagName });
    }
  }

  private async handleWriteTag(args: any): Promise<ToolResult> {
    const guard = this.ensureWritesAllowed("write_tag");
    if (guard) return guard;
    const tagName = String(args?.tag_name || "");
    const value = args?.value;
    const elements = args?.elements !== undefined ? Number(args.elements) : undefined;
    try {
      const { durationMs } = await this.controller.writeTag(tagName, value, elements);
      return makeResult(true, { tag: tagName, value }, null, {
        duration_ms: Number(durationMs.toFixed(3))
      });
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err), { tag_name: tagName });
    }
  }

  private async handleReadArray(args: any): Promise<ToolResult> {
    return this.handleReadTag(args);
  }

  private async handleWriteArray(args: any): Promise<ToolResult> {
    const values = args?.values;
    if (!Array.isArray(values)) {
      return makeResult(false, undefined, "values must be an array");
    }
    return this.handleWriteTag({ ...args, value: values });
  }

  private async handleReadString(args: any): Promise<ToolResult> {
    const result = await this.handleReadTag(args);
    if (result.success && typeof result.data?.result?.value !== "string") {
      result.data.result.value = String(result.data.result.value ?? "");
    }
    return result;
  }

  private async handleWriteString(args: any): Promise<ToolResult> {
    if (typeof args?.value !== "string") {
      return makeResult(false, undefined, "value must be a string");
    }
    return this.handleWriteTag(args);
  }

  private async handleGetTagList(): Promise<ToolResult> {
    return makeResult(false, undefined, "Tag list enumeration not implemented yet");
  }

  private async handleReadMultipleTags(args: any): Promise<ToolResult> {
    const tags = Array.isArray(args?.tags) ? args.tags.map((t: any) => String(t)) : undefined;
    if (!tags || !tags.length) {
      return makeResult(false, undefined, "tags must be a non-empty array");
    }
    try {
      const { results, durationMs } = await this.controller.readMultiple(tags);
      return makeResult(true, { results }, null, { count: results.length, duration_ms: Number(durationMs.toFixed(3)) });
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err));
    }
  }

  private async handleWriteMultipleTags(args: any): Promise<ToolResult> {
    const guard = this.ensureWritesAllowed("write_multiple_tags");
    if (guard) return guard;
    const payloads = Array.isArray(args?.payloads) ? args.payloads : undefined;
    if (!payloads || !payloads.length) {
      return makeResult(false, undefined, "payloads must be a non-empty array");
    }
    const entries = payloads.map((item: any) => ({
      name: String(item?.tag_name || item?.tag || ""),
      value: item?.value
    }));
    if (entries.some((entry) => !entry.name)) {
      return makeResult(false, undefined, "Each payload requires tag_name");
    }
    try {
      const { durationMs } = await this.controller.writeMultiple(entries);
      return makeResult(true, { written: entries.map((e) => ({ tag: e.name, value: e.value })) }, null, {
        count: entries.length,
        duration_ms: Number(durationMs.toFixed(3))
      });
    } catch (err: any) {
      return makeResult(false, undefined, err?.message || String(err));
    }
  }

  private async handleListTags(): Promise<ToolResult> {
    return makeResult(true, { aliases: this.tagMap.list(), count: this.tagMap.count() });
  }

  private async handleReadAlias(args: any): Promise<ToolResult> {
    const alias = String(args?.alias || "");
    const spec = this.tagMap.get(alias);
    if (!spec) return makeResult(false, undefined, `Unknown alias '${alias}'`);
    const response = await this.handleReadTag({ tag_name: spec.tag });
    if (response.success) {
      const value = response.data?.result?.value;
      response.data.result.value = applyScaling(value, spec, "to_eng");
      response.data.alias = alias;
    }
    return response;
  }

  private async handleWriteAlias(args: any): Promise<ToolResult> {
    const guard = this.ensureWritesAllowed("write_tag_by_alias");
    if (guard) return guard;
    const alias = String(args?.alias || "");
    const spec = this.tagMap.get(alias);
    if (!spec) return makeResult(false, undefined, `Unknown alias '${alias}'`);
    const value = applyScaling(args?.value, spec, "to_raw");
    return this.handleWriteTag({ tag_name: spec.tag, value });
  }

  private async handlePing(): Promise<ToolResult> {
    return makeResult(true, {
      connection: this.controller.connectionMeta(),
      writes_enabled: this.config.writesEnabled,
      system_cmds_enabled: this.config.systemCmdsEnabled,
      tag_aliases: this.tagMap.count()
    });
  }

  private async handleConnectionStatus(): Promise<ToolResult> {
    return makeResult(true, this.controller.connectionMeta());
  }
}

const config = loadEnv();
const server = new EtherNetIPMCPServer(config);

server.run().catch(async (err) => {
  console.error(err);
  await server.shutdown();
  process.exit(1);
});
