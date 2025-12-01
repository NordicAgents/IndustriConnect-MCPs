import { MCPServer, MCPServerConfig, MCPTool, MCPToolCallResult } from '../types/mcp-types';

// WebSocket message types matching the backend
interface WSMessage {
    type: string;
    [key: string]: any;
}

class MCPClientManager {
    private servers: Map<string, MCPServer> = new Map();
    private listeners: ((servers: MCPServer[]) => void)[] = [];
    private ws: WebSocket | null = null;
    private isConnected = false;

    constructor() {
        this.connectWebSocket();
    }

    private connectWebSocket() {
        try {
            // Connect to the backend WebSocket server
            this.ws = new WebSocket('ws://localhost:3003');

            this.ws.onopen = () => {
                console.log('[MCP Client] Connected to backend');
                this.isConnected = true;
                // Re-connect any servers that should be connected
                this.reconnectServers();
            };

            this.ws.onclose = () => {
                console.log('[MCP Client] Disconnected from backend');
                this.isConnected = false;
                // Mark all servers as error/disconnected
                this.servers.forEach(server => {
                    if (server.status === 'connected' || server.status === 'connecting') {
                        this.updateServerStatus(server.id, 'error', 'Backend connection lost');
                    }
                });
                // Try to reconnect
                setTimeout(() => this.connectWebSocket(), 3000);
            };

            this.ws.onerror = (error) => {
                console.error('[MCP Client] WebSocket error:', error);
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data) as WSMessage;
                    this.handleMessage(message);
                } catch (error) {
                    console.error('[MCP Client] Error parsing message:', error);
                }
            };
        } catch (error) {
            console.error('[MCP Client] Connection failed:', error);
            setTimeout(() => this.connectWebSocket(), 3000);
        }
    }

    private handleMessage(message: WSMessage) {
        switch (message.type) {
            case 'server_spawned':
                this.updateServerStatus(
                    message.serverId,
                    message.status,
                    message.error
                );
                break;

            case 'tools_listed':
                this.updateServerTools(message.serverId, message.tools);
                break;

            case 'tool_result':
                // Handle tool execution result via event dispatch
                const event = new CustomEvent('mcp-tool-result', { detail: message });
                window.dispatchEvent(event);
                break;

            case 'error':
                console.error('[MCP Client] Backend error:', message.message);
                break;
        }
    }

    private reconnectServers() {
        this.servers.forEach(server => {
            if (server.status === 'connected' || server.status === 'connecting') {
                this.connectToServer(server.id, server.config);
            }
        });
    }

    getServers(): MCPServer[] {
        return Array.from(this.servers.values());
    }

    getServer(id: string): MCPServer | undefined {
        return this.servers.get(id);
    }

    addServer(server: MCPServer) {
        this.servers.set(server.id, server);
        this.notifyListeners();
    }

    removeServer(id: string) {
        this.disconnectFromServer(id);
        this.servers.delete(id);
        this.notifyListeners();
    }

    updateServerConfig(id: string, config: MCPServerConfig) {
        const server = this.servers.get(id);
        if (server) {
            server.config = config;
            this.notifyListeners();
        }
    }

    async connectToServer(id: string, config?: MCPServerConfig) {
        const server = this.servers.get(id);
        if (!server) return;

        if (!this.isConnected || !this.ws) {
            this.updateServerStatus(id, 'error', 'Backend not connected');
            return;
        }

        this.updateServerStatus(id, 'connecting');

        // Send spawn request to backend
        this.ws.send(JSON.stringify({
            type: 'spawn_server',
            serverId: id,
            serverName: server.name,
            config: config || server.config
        }));
    }

    async disconnectFromServer(id: string) {
        const server = this.servers.get(id);
        if (!server) return;

        if (this.isConnected && this.ws) {
            this.ws.send(JSON.stringify({
                type: 'disconnect_server',
                serverId: id
            }));
        }

        this.updateServerStatus(id, 'disconnected');
        // Clear tools on disconnect
        server.tools = [];
        this.notifyListeners();
    }

    async callTool(serverId: string, toolName: string, args: any): Promise<MCPToolCallResult> {
        const server = this.servers.get(serverId);
        if (!server) {
            throw new Error(`Server ${serverId} not found`);
        }

        if (!this.isConnected || !this.ws) {
            throw new Error('Backend not connected');
        }

        return new Promise((resolve, reject) => {
            const handleResult = (event: Event) => {
                const customEvent = event as CustomEvent;
                const message = customEvent.detail;

                if (message.type === 'tool_result' &&
                    message.serverId === serverId &&
                    message.toolName === toolName) {

                    window.removeEventListener('mcp-tool-result', handleResult);

                    if (message.success) {
                        resolve(message.result);
                    } else {
                        reject(new Error(message.error || 'Tool execution failed'));
                    }
                }
            };

            window.addEventListener('mcp-tool-result', handleResult);

            // Send the call request
            this.ws?.send(JSON.stringify({
                type: 'call_tool',
                serverId,
                toolName,
                arguments: args
            }));

            // Timeout after 30 seconds
            setTimeout(() => {
                window.removeEventListener('mcp-tool-result', handleResult);
                reject(new Error('Tool execution timed out'));
            }, 30000);
        });
    }

    // Compatibility method for existing code
    onConnectionChange(listener: (servers: MCPServer[]) => void) {
        return this.subscribe(listener);
    }

    subscribe(listener: (servers: MCPServer[]) => void) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener);
        };
    }

    private notifyListeners() {
        const servers = this.getServers();
        this.listeners.forEach((listener) => listener(servers));
    }

    private updateServerStatus(
        id: string,
        status: MCPServer['status'],
        error?: string
    ) {
        const server = this.servers.get(id);
        if (server) {
            server.status = status;
            if (error) server.error = error;
            else delete server.error;
            this.notifyListeners();
        }
    }

    private updateServerTools(id: string, tools: MCPTool[]) {
        const server = this.servers.get(id);
        if (server) {
            server.tools = tools;
            this.notifyListeners();
        }
    }
}

export const mcpClientManager = new MCPClientManager();
