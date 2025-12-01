/**
 * MCP Server Configuration Types
 */
export interface MCPServerConfig {
    command: string;
    args: string[];
    env?: Record<string, string>;
}

export interface MCPServersConfig {
    mcpServers: Record<string, MCPServerConfig>;
}

/**
 * MCP Tool Types
 */
export interface MCPToolParameter {
    type: string;
    description?: string;
    required?: boolean;
    enum?: string[];
    properties?: Record<string, MCPToolParameter>;
    items?: MCPToolParameter;
}

export interface MCPTool {
    name: string;
    description?: string;
    inputSchema: {
        type: string;
        properties?: Record<string, MCPToolParameter>;
        required?: string[];
    };
}

/**
 * WebSocket Message Types
 */
export interface WSMessage {
    type: string;
    [key: string]: any;
}

export interface SpawnServerMessage extends WSMessage {
    type: 'spawn_server';
    serverId: string;
    serverName: string;
    config: MCPServerConfig;
}

export interface ListToolsMessage extends WSMessage {
    type: 'list_tools';
    serverId: string;
}

export interface CallToolMessage extends WSMessage {
    type: 'call_tool';
    serverId: string;
    toolName: string;
    arguments: Record<string, unknown>;
}

export interface DisconnectServerMessage extends WSMessage {
    type: 'disconnect_server';
    serverId: string;
}

/**
 * Server Response Types
 */
export interface ServerSpawnedMessage extends WSMessage {
    type: 'server_spawned';
    serverId: string;
    status: 'connected' | 'error';
    error?: string;
}

export interface ToolsListedMessage extends WSMessage {
    type: 'tools_listed';
    serverId: string;
    tools: MCPTool[];
}

export interface ToolResultMessage extends WSMessage {
    type: 'tool_result';
    serverId: string;
    toolName: string;
    success: boolean;
    result?: any;
    error?: string;
}

export interface ServerDisconnectedMessage extends WSMessage {
    type: 'server_disconnected';
    serverId: string;
}

export interface ErrorMessage extends WSMessage {
    type: 'error';
    message: string;
    serverId?: string;
}
