import {
  MCPConfig,
  MCPSession,
  ChatBackend,
  CloudLLMConfig,
  OllamaConfig,
} from '../types';

const STORAGE_KEYS = {
  MCP_CONFIGS: 'mcp_configs',
  SESSIONS: 'mcp_sessions',
  CHAT_BACKEND: 'chat_backend',
  CLOUD_LLM_CONFIG: 'cloud_llm_config',
  OLLAMA_CONFIG: 'ollama_config',
} as const;

export const saveMCPConfigs = (configs: MCPConfig[]) => {
  localStorage.setItem(STORAGE_KEYS.MCP_CONFIGS, JSON.stringify(configs));
};

export const loadMCPConfigs = (): MCPConfig[] => {
  const stored = localStorage.getItem(STORAGE_KEYS.MCP_CONFIGS);
  if (!stored) return [];
  try {
    return JSON.parse(stored).map((config: any) => ({
      ...config,
      lastConnected: config.lastConnected ? new Date(config.lastConnected) : undefined,
      tools: Array.isArray(config.tools) ? config.tools : [],
    }));
  } catch {
    return [];
  }
};

export const saveSessions = (sessions: MCPSession[]) => {
  localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
};

export const loadSessions = (): MCPSession[] => {
  const stored = localStorage.getItem(STORAGE_KEYS.SESSIONS);
  if (!stored) return [];
  try {
    return JSON.parse(stored).map((session: any) => ({
      ...session,
      createdAt: new Date(session.createdAt),
      lastActivity: new Date(session.lastActivity),
    }));
  } catch {
    return [];
  }
};

export const saveChatBackend = (backend: ChatBackend) => {
  localStorage.setItem(STORAGE_KEYS.CHAT_BACKEND, backend);
};

export const loadChatBackend = (): ChatBackend => {
  const stored = localStorage.getItem(
    STORAGE_KEYS.CHAT_BACKEND,
  ) as ChatBackend | null;
  if (stored === 'cloud-llm' || stored === 'ollama' || stored === 'mcp') {
    return stored;
  }
  return 'mcp';
};

export const saveCloudLLMConfig = (config: CloudLLMConfig | null) => {
  if (!config) {
    localStorage.removeItem(STORAGE_KEYS.CLOUD_LLM_CONFIG);
    return;
  }
  const { provider, model, baseUrl } = config;
  const safeConfig: Pick<CloudLLMConfig, 'provider' | 'model' | 'baseUrl'> = {
    provider,
    model,
    baseUrl,
  };
  localStorage.setItem(
    STORAGE_KEYS.CLOUD_LLM_CONFIG,
    JSON.stringify(safeConfig),
  );
};

export const loadCloudLLMConfig = (): CloudLLMConfig | null => {
  const stored = localStorage.getItem(STORAGE_KEYS.CLOUD_LLM_CONFIG);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as CloudLLMConfig;
  } catch {
    return null;
  }
};

export const saveOllamaConfig = (config: OllamaConfig | null) => {
  if (!config) {
    localStorage.removeItem(STORAGE_KEYS.OLLAMA_CONFIG);
    return;
  }
  localStorage.setItem(STORAGE_KEYS.OLLAMA_CONFIG, JSON.stringify(config));
};

export const loadOllamaConfig = (): OllamaConfig | null => {
  const stored = localStorage.getItem(STORAGE_KEYS.OLLAMA_CONFIG);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as OllamaConfig;
  } catch {
    return null;
  }
};
