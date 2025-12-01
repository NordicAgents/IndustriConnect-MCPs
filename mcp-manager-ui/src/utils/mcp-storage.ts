/**
 * LocalStorage utilities for MCP server configurations
 */

import { MCPServersConfig, MCPServer, MCPConnectionStatus } from '../types/mcp-types';

const MCP_SERVERS_KEY = 'mcp_servers_config';
const MCP_STATUS_KEY = 'mcp_servers_status';

/**
 * Load MCP server configurations from localStorage
 */
export function loadMCPServersConfig(): MCPServersConfig {
    try {
        const stored = localStorage.getItem(MCP_SERVERS_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Error loading MCP servers config:', error);
    }
    return { mcpServers: {} };
}

/**
 * Save MCP server configurations to localStorage
 */
export function saveMCPServersConfig(config: MCPServersConfig): void {
    try {
        localStorage.setItem(MCP_SERVERS_KEY, JSON.stringify(config));
    } catch (error) {
        console.error('Error saving MCP servers config:', error);
    }
}

/**
 * Load MCP server connection statuses from localStorage
 */
export function loadMCPServerStatuses(): Record<string, { status: MCPConnectionStatus; error?: string }> {
    try {
        const stored = localStorage.getItem(MCP_STATUS_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Error loading MCP server statuses:', error);
    }
    return {};
}

/**
 * Save MCP server connection statuses to localStorage
 */
export function saveMCPServerStatuses(statuses: Record<string, { status: MCPConnectionStatus; error?: string }>): void {
    try {
        localStorage.setItem(MCP_STATUS_KEY, JSON.stringify(statuses));
    } catch (error) {
        console.error('Error saving MCP server statuses:', error);
    }
}

/**
 * Import MCP configuration from Cursor-style JSON
 */
export function importCursorConfig(jsonString: string): MCPServersConfig | null {
    try {
        const parsed = JSON.parse(jsonString);
        if (parsed.mcpServers && typeof parsed.mcpServers === 'object') {
            return parsed as MCPServersConfig;
        }
        console.error('Invalid MCP config format');
        return null;
    } catch (error) {
        console.error('Error parsing MCP config JSON:', error);
        return null;
    }
}

/**
 * Export MCP configuration to Cursor-style JSON
 */
export function exportCursorConfig(config: MCPServersConfig): string {
    return JSON.stringify(config, null, 2);
}

/**
 * Convert MCPServersConfig to array of MCPServer instances
 */
export function configToServers(config: MCPServersConfig): MCPServer[] {
    const servers: MCPServer[] = [];
    const statuses = loadMCPServerStatuses();

    Object.entries(config.mcpServers).forEach(([name, serverConfig]) => {
        const id = name.toLowerCase().replace(/\s+/g, '-');
        const statusData = statuses[id] || { status: 'disconnected' as MCPConnectionStatus };

        servers.push({
            id,
            name,
            config: serverConfig,
            status: statusData.status,
            error: statusData.error,
        });
    });

    return servers;
}
