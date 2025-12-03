import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MCPServerConfig, MCPTool } from './types.js';

interface MCPServerInstance {
    id: string;
    name: string;
    config: MCPServerConfig;
    client: Client;
    transport: StdioClientTransport;
    tools: MCPTool[];
    status: 'connecting' | 'connected' | 'error' | 'disconnected';
    error?: string;
}

export class MCPServerManager {
    private servers: Map<string, MCPServerInstance> = new Map();

    /**
     * Spawn and connect to an MCP server
     */
    async spawnServer(
        serverId: string,
        serverName: string,
        config: MCPServerConfig
    ): Promise<{ success: boolean; error?: string; tools?: MCPTool[] }> {
        try {
            console.log(`[MCP Manager] Spawning server ${serverName} (${serverId})`);
            console.log(`[MCP Manager] Command: ${config.command} ${config.args.join(' ')}`);

            // Create MCP client with stdio transport
            // StdioClientTransport handles spawning the process
            const transport = new StdioClientTransport({
                command: config.command,
                args: config.args,
                env: { ...process.env, ...config.env } as Record<string, string>, // Merge with current env
                stderr: 'inherit', // Pipe stderr to parent stderr for debugging
            });

            const client = new Client(
                {
                    name: 'mcp-backend-client',
                    version: '1.0.0',
                },
                {
                    capabilities: {},
                }
            );

            // Connect to the server
            console.log(`[MCP Manager] Connecting to ${serverName}...`);
            await client.connect(transport);

            console.log(`[MCP Manager] Connected to ${serverName}`);

            // List available tools
            const toolsResponse = await client.listTools();
            const tools: MCPTool[] = toolsResponse.tools.map((tool: any) => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema,
            }));

            console.log(`[MCP Manager] Found ${tools.length} tools from ${serverName}`);

            // Store server instance
            // Note: We don't have direct access to the child process from StdioClientTransport in the current SDK version easily,
            // but the transport manages it. We'll store the client and transport.
            const serverInstance: MCPServerInstance = {
                id: serverId,
                name: serverName,
                config,
                client,
                transport,
                tools,
                status: 'connected',
            };

            this.servers.set(serverId, serverInstance);

            // Set up error handling if possible via transport (depends on SDK internals)
            transport.onerror = (error) => {
                console.error(`[MCP Manager] Transport error for ${serverName}:`, error);
                serverInstance.status = 'error';
                serverInstance.error = String(error);
            };

            transport.onclose = () => {
                console.log(`[MCP Manager] Transport closed for ${serverName}`);
                serverInstance.status = 'disconnected';
                this.servers.delete(serverId);
            };

            return { success: true, tools };
        } catch (error) {
            console.error(`[MCP Manager] Failed to spawn server ${serverName}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * List tools from a connected server
     */
    async listTools(serverId: string): Promise<MCPTool[]> {
        const server = this.servers.get(serverId);
        if (!server) {
            throw new Error(`Server ${serverId} not found`);
        }

        if (server.status !== 'connected') {
            throw new Error(`Server ${serverId} is not connected`);
        }

        return server.tools;
    }

    /**
     * Call a tool on a connected server
     */
    async callTool(
        serverId: string,
        toolName: string,
        args: Record<string, unknown>
    ): Promise<any> {
        const server = this.servers.get(serverId);
        if (!server) {
            throw new Error(`Server ${serverId} not found`);
        }

        if (server.status !== 'connected') {
            throw new Error(`Server ${serverId} is not connected`);
        }

        console.log(`[MCP Manager] Calling tool ${toolName} on ${server.name}`);
        console.log(`[MCP Manager] Arguments:`, args);

        try {
            const result = await server.client.callTool({
                name: toolName,
                arguments: args,
            });

            console.log(`[MCP Manager] Tool result:`, result);
            return result;
        } catch (error) {
            console.error(`[MCP Manager] Tool call failed:`, error);
            throw error;
        }
    }

    /**
     * Disconnect from a server
     */
    async disconnectServer(serverId: string): Promise<void> {
        const server = this.servers.get(serverId);
        if (!server) {
            return; // Already disconnected
        }

        console.log(`[MCP Manager] Disconnecting server ${server.name}`);

        try {
            await server.client.close();
            await server.transport.close();
            this.servers.delete(serverId);
        } catch (error) {
            console.error(`[MCP Manager] Error disconnecting server:`, error);
        }
    }

    /**
     * Get server status
     */
    getServerStatus(serverId: string): string {
        const server = this.servers.get(serverId);
        return server?.status || 'disconnected';
    }

    /**
     * Cleanup all servers
     */
    async cleanup(): Promise<void> {
        console.log('[MCP Manager] Cleaning up all servers');
        const serverIds = Array.from(this.servers.keys());
        for (const serverId of serverIds) {
            await this.disconnectServer(serverId);
        }
    }
}
