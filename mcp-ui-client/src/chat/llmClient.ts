import OpenAI from "openai";
import {
  ChatCompletionMessageParam,
  ChatCompletionTool
} from "openai/resources/chat/completions";
import { LlmConfig } from "../config";
import { RegisteredTool } from "../mcp/serverRegistry";

export interface BuiltTools {
  tools: ChatCompletionTool[];
  index: Record<string, RegisteredTool>;
}

export class LlmClient {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(config: LlmConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl
    });
    this.model = config.model;
  }

  async complete(
    messages: ChatCompletionMessageParam[],
    tools?: ChatCompletionTool[]
  ) {
    return this.client.chat.completions.create({
      model: this.model,
      messages,
      tools,
      tool_choice: tools && tools.length ? "auto" : "none"
    });
  }
}

export function encodeToolName(serverName: string, toolName: string): string {
  // OpenAI tool names must match /^[a-zA-Z0-9_-]+$/.
  // Use "__" as a safe separator instead of "::".
  return `${serverName}__${toolName}`;
}

export function decodeToolName(encoded: string): {
  serverName: string;
  toolName: string;
} {
  const [serverName, ...rest] = encoded.split("__");
  return { serverName, toolName: rest.join("__") };
}

export function buildLlmTools(tools: RegisteredTool[]): BuiltTools {
  const index: Record<string, RegisteredTool> = {};
  const mapped: ChatCompletionTool[] = tools.map((tool) => {
    const encodedName = encodeToolName(tool.serverName, tool.name);
    index[encodedName] = tool;
    return {
      type: "function",
      function: {
        name: encodedName,
        description: tool.description || `Tool from ${tool.serverName}`,
        parameters:
          (tool.inputSchema as Record<string, unknown>) ?? {
            type: "object",
            properties: {}
          }
      }
    };
  });

  return { tools: mapped, index };
}
