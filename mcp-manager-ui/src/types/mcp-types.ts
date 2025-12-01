/**
 * MCP (Model Context Protocol) Type Definitions
 * Based on Cursor IDE's MCP server configuration format
 */

/**
 * Environment variables for MCP server
 */
export interface MCPServerEnv {
    [key: string]: string;
}

/**
 * MCP Server Configuration (matches Cursor's config format)
 */
export interface MCPServerConfig {
    command: string;
    args: string[];
    env?: MCPServerEnv;
}

/**
 * MCP Servers configuration object (matches Cursor's JSON structure)
 */
export interface MCPServersConfig {
    mcpServers: {
        [serverName: string]: MCPServerConfig;
    };
}

/**
 * Connection status for an MCP server
 */
export type MCPConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Running MCP server instance with connection info
 */
export interface MCPServer {
    id: string;
    name: string;
    config: MCPServerConfig;
    status: MCPConnectionStatus;
    connectedAt?: Date;
    error?: string;
    tools?: MCPTool[];
    resources?: MCPResource[];
}

/**
 * MCP Tool parameter schema
 */
export interface MCPToolParameter {
    type: string;
    description?: string;
    required?: boolean;
    enum?: string[];
    properties?: { [key: string]: MCPToolParameter };
    items?: MCPToolParameter;
}

/**
 * MCP Tool definition
 */
export interface MCPTool {
    name: string;
    description?: string;
    inputSchema: {
        type: string;
        properties?: { [key: string]: MCPToolParameter };
        required?: string[];
    };
}

/**
 * MCP Resource definition
 */
export interface MCPResource {
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
}

/**
 * Tool call request
 */
export interface MCPToolCallRequest {
    serverId: string;
    toolName: string;
    arguments: Record<string, unknown>;
}

/**
 * Tool call result
 */
export interface MCPToolCallResult {
    success: boolean;
    result?: unknown;
    error?: string;
    isError?: boolean;
    content?: Array<{
        type: string;
        text?: string;
    }>;
}

/**
 * Tool call in chat message
 */
export interface MCPToolCall {
    id: string;
    toolName: string;
    serverId: string;
    serverName: string;
    arguments: Record<string, unknown>;
    result?: MCPToolCallResult;
    timestamp: Date;
}
