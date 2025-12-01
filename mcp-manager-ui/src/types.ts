export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  error?: boolean;
  toolCalls?: import('./types/mcp-types').MCPToolCall[];
}

export interface ChatSession {
  id: string;
  name: string;
  createdAt: Date;
  lastActivity: Date;
}

export type ChatBackend = 'cloud-llm' | 'ollama';

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
