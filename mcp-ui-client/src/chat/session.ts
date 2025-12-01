import readline from "node:readline";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { loadAllConfig } from "../config";
import { McpServerRegistry, RegisteredTool } from "../mcp/serverRegistry";
import {
  buildLlmTools,
  decodeToolName,
  LlmClient
} from "./llmClient";

export interface SessionOptions {
  configPath?: string;
  serverFilter?: string[];
}

export interface ListToolsOptions {
  configPath?: string;
  serverFilter?: string[];
}

export interface CallToolOptions {
  configPath?: string;
  serverName: string;
  toolName: string;
  argsJson?: string;
}

export async function listToolsCli(options: ListToolsOptions): Promise<void> {
  const { client, llm } = loadAllConfig(options.configPath);
  const registry = new McpServerRegistry(
    client.mcpServers,
    llm.requestTimeoutMs
  );
  const tools = await registry.getAllTools(options.serverFilter);
  printTools(tools);
  await registry.stopAll();
}

export async function callToolCli(options: CallToolOptions): Promise<void> {
  const { client, llm } = loadAllConfig(options.configPath);
  const registry = new McpServerRegistry(
    client.mcpServers,
    llm.requestTimeoutMs
  );

  let args: Record<string, unknown> = {};
  if (options.argsJson) {
    try {
      args = JSON.parse(options.argsJson);
    } catch (err) {
      throw new Error(`Failed to parse JSON args: ${options.argsJson}`);
    }
  }

  const result = await registry.callTool(
    options.serverName,
    options.toolName,
    args
  );
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
  await registry.stopAll();
}

export async function startInteractiveSession(
  options: SessionOptions
): Promise<void> {
  const { client, llm } = loadAllConfig(options.configPath);
  const registry = new McpServerRegistry(
    client.mcpServers,
    llm.requestTimeoutMs
  );
  const llmClient = new LlmClient(llm);

  const availableTools = await registry.getAllTools(options.serverFilter);
  const builtTools = buildLlmTools(availableTools);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // eslint-disable-next-line no-console
  console.log("Interactive MCP chat. Type :q or :quit to exit.");

  const messages: ChatCompletionMessageParam[] = [];

  rl.setPrompt("> ");
  rl.prompt();

  const shutdown = async () => {
    await registry.stopAll();
    rl.close();
    process.exit(0);
  };

  rl.on("SIGINT", shutdown);

  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (trimmed === ":q" || trimmed === ":quit" || trimmed === ":exit") {
      await shutdown();
      return;
    }

    if (!trimmed.length) {
      rl.prompt();
      return;
    }

    try {
      await handleUserInput(
        trimmed,
        messages,
        llmClient,
        registry,
        builtTools.tools
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Chat loop error:", err);
    } finally {
      rl.prompt();
    }
  });
}

async function handleUserInput(
  input: string,
  messages: ChatCompletionMessageParam[],
  llmClient: LlmClient,
  registry: McpServerRegistry,
  tools: ReturnType<typeof buildLlmTools>["tools"]
): Promise<void> {
  messages.push({ role: "user", content: input });

  while (true) {
    const completion = await llmClient.complete(messages, tools);
    const choice = completion.choices[0]?.message;

    if (!choice) {
      // eslint-disable-next-line no-console
      console.warn("No assistant response received");
      break;
    }

    if (choice.tool_calls && choice.tool_calls.length) {
      // Preserve the assistant tool call request in history
      messages.push({
        role: "assistant",
        content: choice.content ?? "",
        tool_calls: choice.tool_calls
      });

      for (const toolCall of choice.tool_calls) {
        const decoded = decodeToolName(toolCall.function.name);
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = toolCall.function.arguments
            ? JSON.parse(toolCall.function.arguments)
            : {};
        } catch (err) {
          parsedArgs = {};
        }

        let result: unknown;
        try {
          result = await registry.callTool(
            decoded.serverName,
            decoded.toolName,
            parsedArgs
          );
        } catch (err) {
          result = { error: (err as Error).message || "Tool call failed" };
        }

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }

      // Loop to let the LLM respond to tool results.
      continue;
    }

    if (choice.content) {
      // eslint-disable-next-line no-console
      console.log(choice.content);
    }

    messages.push({
      role: "assistant",
      content: choice.content ?? ""
    });
    break;
  }
}

function printTools(tools: RegisteredTool[]): void {
  if (!tools.length) {
    // eslint-disable-next-line no-console
    console.log("No tools discovered.");
    return;
  }

  // eslint-disable-next-line no-console
  console.log("Tools:");
  for (const tool of tools) {
    // eslint-disable-next-line no-console
    console.log(`- ${tool.serverName} :: ${tool.name} - ${tool.description ?? ""}`);
  }
}
