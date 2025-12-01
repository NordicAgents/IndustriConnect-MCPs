import { Command } from "commander";
import {
  callToolCli,
  listToolsCli,
  startInteractiveSession
} from "./chat/session";

const program = new Command();

program
  .name("mcp-ui-client")
  .description("Local MCP client for MCP Manager UI and protocol servers")
  .version("0.1.0")
  .option("-c, --config <path>", "Path to mcp.json (defaults to ./mcp.json)");

program
  .command("chat")
  .description("Start an interactive chat session with configured MCP servers")
  .option(
    "-s, --servers <names>",
    "Comma-separated server names to enable (defaults to all)"
  )
  .action(async (cmd) => {
    const configPath = program.opts().config as string | undefined;
    const serverFilter = cmd.servers
      ? String(cmd.servers)
          .split(",")
          .map((item: string) => item.trim())
          .filter(Boolean)
      : undefined;
    await startInteractiveSession({ configPath, serverFilter });
  });

program
  .command("list-tools")
  .description("List tools from configured MCP servers")
  .option(
    "-s, --servers <names>",
    "Comma-separated server names to enable (defaults to all)"
  )
  .action(async (cmd) => {
    const configPath = program.opts().config as string | undefined;
    const serverFilter = cmd.servers
      ? String(cmd.servers)
          .split(",")
          .map((item: string) => item.trim())
          .filter(Boolean)
      : undefined;
    await listToolsCli({ configPath, serverFilter });
  });

program
  .command("call <server> <tool> [argsJson]")
  .description("Call a specific tool once and print the JSON result")
  .action(async (server: string, tool: string, argsJson?: string) => {
    const configPath = program.opts().config as string | undefined;
    await callToolCli({
      configPath,
      serverName: server,
      toolName: tool,
      argsJson
    });
  });

program.parseAsync().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
