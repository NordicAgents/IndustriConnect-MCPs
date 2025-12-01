import { McpServerConfig } from "../config";
import { McpConnection, McpTool } from "./connection";

export interface RegisteredTool extends McpTool {
  serverName: string;
}

export class McpServerRegistry {
  private readonly connections = new Map<string, McpConnection>();
  private readonly serverConfigs: Record<string, McpServerConfig>;
  private readonly requestTimeoutMs: number;

  constructor(
    serverConfigs: Record<string, McpServerConfig>,
    requestTimeoutMs: number
  ) {
    this.serverConfigs = serverConfigs;
    this.requestTimeoutMs = requestTimeoutMs;
  }

  async listToolsForServer(serverName: string): Promise<RegisteredTool[]> {
    const connection = await this.getConnection(serverName);
    const tools = await connection.listTools();
    return tools.map((tool) => ({
      ...tool,
      serverName
    }));
  }

  async getAllTools(serverFilter?: string[]): Promise<RegisteredTool[]> {
    const entries = Object.entries(this.serverConfigs);
    const filtered = (serverFilter?.length
      ? entries.filter(([name]) => serverFilter.includes(name))
      : entries
    ).filter(([, cfg]) => {
      if (!cfg.command) {
        // eslint-disable-next-line no-console
        console.warn(
          "Skipping URL-based MCP entry (not supported yet in this client):",
          cfg
        );
        return false;
      }
      return true;
    });

    const all: RegisteredTool[] = [];
    for (const [serverName] of filtered) {
      try {
        const tools = await this.listToolsForServer(serverName);
        all.push(...tools);
      } catch (err) {
        // Do not crash the client if one server fails.
        // eslint-disable-next-line no-console
        console.warn(`Failed to list tools for ${serverName}:`, err);
      }
    }
    return all;
  }

  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const connection = await this.getConnection(serverName);
    return connection.callTool(toolName, args);
  }

  async stopAll(): Promise<void> {
    for (const connection of this.connections.values()) {
      connection.stop();
    }
    this.connections.clear();
  }

  private async getConnection(serverName: string): Promise<McpConnection> {
    const existing = this.connections.get(serverName);
    if (existing) return existing;

    const config = this.serverConfigs[serverName];
    if (!config) {
      throw new Error(`No MCP server config found for ${serverName}`);
    }
    if (!config.command) {
      throw new Error(
        `Server ${serverName} uses a URL endpoint. URL/SSE servers are not supported yet in this client.`
      );
    }

    const connection = new McpConnection(
      serverName,
      config,
      this.requestTimeoutMs
    );
    this.connections.set(serverName, connection);
    return connection;
  }
}
