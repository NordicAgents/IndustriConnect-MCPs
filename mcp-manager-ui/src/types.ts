export type MCPType =
  | 'BACnet'
  | 'DNP3'
  | 'EtherCAT'
  | 'EtherNet/IP'
  | 'MODBUS'
  | 'MQTT'
  | 'OPC UA'
  | 'PROFIBUS'
  | 'PROFINET'
  | 'S7comm';

export interface MCPConfig {
  id: string;
  name: string;
  type: MCPType;
  command: string;
  args?: string[];
  env: Record<string, string>;
  enabled: boolean;
  connected: boolean;
  lastConnected?: Date;
  tools?: string[];
}

export interface MCPSession {
  id: string;
  name: string;
  mcpIds: string[];
  createdAt: Date;
  lastActivity: Date;
}

export interface ChatMessage {
  id: string;
  mcpId?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  error?: boolean;
}

export interface MCPServer {
  id: string;
  name: string;
  type: MCPType;
  config: MCPConfig;
}

export type ChatBackend = 'mcp' | 'cloud-llm' | 'ollama';

export type CloudProvider = 'openai' | 'gemini' | 'anthropic';

export interface CloudLLMConfig {
  provider: CloudProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface OllamaConfig {
  baseUrl: string;
  model: string;
}
