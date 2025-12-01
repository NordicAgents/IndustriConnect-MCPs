import fs from "node:fs";
import path from "node:path";
import { config as loadDotEnv } from "dotenv";
import { z } from "zod";

const serverSchema = z
  .object({
    command: z.string().trim().optional(),
    args: z.array(z.string()).optional(),
    cwd: z.string().optional(),
    env: z.record(z.string()).optional(),
    url: z.string().optional()
  })
  .refine(
    (value) => Boolean(value.command) || Boolean(value.url),
    "Each MCP server needs either a command (process) or a url (remote/SSE)."
  );

const clientConfigSchema = z.object({
  mcpServers: z.record(serverSchema)
});

export type McpServerConfig = z.infer<typeof serverSchema>;
export type ClientConfig = z.infer<typeof clientConfigSchema>;

export type LlmProvider = "openai";

export interface LlmConfig {
  provider: LlmProvider;
  apiKey: string;
  baseUrl?: string;
  model: string;
  requestTimeoutMs: number;
}

export interface LoadedConfig {
  client: ClientConfig;
  llm: LlmConfig;
}

export function loadClientConfig(configPath?: string): ClientConfig {
  const resolved = configPath
    ? path.resolve(configPath)
    : path.resolve(process.cwd(), "mcp.json");

  if (!fs.existsSync(resolved)) {
    throw new Error(`mcp.json not found at ${resolved}`);
  }

  const raw = fs.readFileSync(resolved, "utf8");
  const parsed = JSON.parse(raw);
  const validated = clientConfigSchema.parse(parsed);
  return validated;
}

export function loadLlmConfig(): LlmConfig {
  loadDotEnv();

  const provider = (process.env.LLM_PROVIDER || "openai") as LlmProvider;
  const apiKey = process.env.OPENAI_API_KEY || "";
  const baseUrl = process.env.OPENAI_BASE_URL || undefined;
  const model = process.env.OPENAI_MODEL || "gpt-4.1";
  const requestTimeoutMs = Number(process.env.MCP_REQUEST_TIMEOUT_MS || "20000");

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required in .env");
  }

  return { provider, apiKey, baseUrl, model, requestTimeoutMs };
}

export function loadAllConfig(configPath?: string): LoadedConfig {
  return {
    client: loadClientConfig(configPath),
    llm: loadLlmConfig()
  };
}
