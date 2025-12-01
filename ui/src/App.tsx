import { useState, useEffect } from 'react';
import { ThemeProvider } from './components/ThemeProvider';
import Sidebar from './components/Sidebar';
import ChatPanel from './components/ChatPanel';
import MCPConfigModal from './components/MCPConfigModal';
import {
  MCPConfig,
  MCPSession,
  ChatMessage,
  ChatBackend,
  CloudLLMConfig,
  OllamaConfig,
} from './types';
import {
  loadMCPConfigs,
  saveMCPConfigs,
  loadSessions,
  saveSessions,
  loadChatBackend,
  saveChatBackend,
  loadCloudLLMConfig,
  saveCloudLLMConfig,
  loadOllamaConfig,
  saveOllamaConfig,
} from './utils/storage';
import { getTheme, setTheme } from './utils/theme';
import { format } from 'date-fns';
import { callCloudLLM, callOllama } from './utils/llm';
import { getDefaultToolsForType } from './data/mcpTemplates';
import { callMcpWithLLM } from './utils/mcpAgent';

function AppContent() {
  const [mcpConfigs, setMcpConfigs] = useState<MCPConfig[]>([]);
  const [sessions, setSessions] = useState<MCPSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<MCPConfig | null>(null);
  const [chatBackend, setChatBackend] = useState<ChatBackend>('mcp');
  const [cloudLLMConfig, setCloudLLMConfig] = useState<CloudLLMConfig | null>(
    null,
  );
  const [ollamaConfig, setOllamaConfig] = useState<OllamaConfig | null>(null);

  const MCP_GATEWAY_URL =
    (import.meta.env.VITE_MCP_GATEWAY_URL as string | undefined) ||
    'http://localhost:8787';

  // Load data from localStorage on mount
  useEffect(() => {
    const configs = loadMCPConfigs();
    const loadedSessions = loadSessions();
    const loadedChatBackend = loadChatBackend();
    const loadedCloudConfig = loadCloudLLMConfig();
    const loadedOllamaConfig = loadOllamaConfig();

    setMcpConfigs(configs);
    setSessions(loadedSessions);
    setChatBackend(loadedChatBackend);
    if (loadedCloudConfig) {
      setCloudLLMConfig(loadedCloudConfig);
    }
    if (loadedOllamaConfig) {
      setOllamaConfig(loadedOllamaConfig);
    }
    
    // Initialize theme
    const currentTheme = getTheme();
    setTheme(currentTheme);
  }, []);

  // Save configs to localStorage whenever they change
  useEffect(() => {
    if (mcpConfigs.length > 0) {
      saveMCPConfigs(mcpConfigs);
    }
  }, [mcpConfigs]);

  // Save sessions to localStorage whenever they change
  useEffect(() => {
    if (sessions.length > 0) {
      saveSessions(sessions);
    }
  }, [sessions]);

  useEffect(() => {
    saveChatBackend(chatBackend);
  }, [chatBackend]);

  useEffect(() => {
    saveCloudLLMConfig(cloudLLMConfig);
  }, [cloudLLMConfig]);

  useEffect(() => {
    saveOllamaConfig(ollamaConfig);
  }, [ollamaConfig]);

  const handleAddMCP = () => {
    setEditingConfig(null);
    setConfigModalOpen(true);
  };

  const handleEditMCP = (config: MCPConfig) => {
    setEditingConfig(config);
    setConfigModalOpen(true);
  };

  const handleSaveMCP = (config: MCPConfig) => {
    setMcpConfigs((prev) => {
      const existingIndex = prev.findIndex((c) => c.id === config.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = config;
        return updated;
      }
      return [...prev, config];
    });
  };

  const handleDeleteMCP = (configId: string) => {
    setMcpConfigs((prev) => prev.filter((c) => c.id !== configId));
  };

  const addSystemMessage = (content: string) => {
    const systemMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'system',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, systemMessage]);
  };

  const handleToggleMCP = async (configId: string) => {
    const targetConfig = mcpConfigs.find((c) => c.id === configId);
    if (!targetConfig) return;

    if (targetConfig.connected || targetConfig.enabled) {
      // Optimistic disconnect
      setMcpConfigs((prev) =>
        prev.map((c) =>
          c.id === configId ? { ...c, enabled: false, connected: false } : c,
        ),
      );
      addSystemMessage(`Disconnecting from ${targetConfig.name}...`);

      try {
        await fetch(`${MCP_GATEWAY_URL}/mcp/disconnect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: configId }),
        });
        addSystemMessage(`Disconnected from ${targetConfig.name}`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown disconnect error';
        addSystemMessage(
          `Error disconnecting from ${targetConfig.name}: ${message}`,
        );
      }
      return;
    }

    const fallbackTools =
      targetConfig.tools && targetConfig.tools.length > 0
        ? targetConfig.tools
        : getDefaultToolsForType(targetConfig.type);

    // Mark as enabled (connecting)
    setMcpConfigs((prev) =>
      prev.map((c) =>
        c.id === configId ? { ...c, enabled: true, tools: fallbackTools } : c,
      ),
    );
    addSystemMessage(`Connecting to ${targetConfig.name}...`);

    try {
      const response = await fetch(`${MCP_GATEWAY_URL}/mcp/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: targetConfig.id,
          name: targetConfig.name,
          type: targetConfig.type,
          command: targetConfig.command,
          args: targetConfig.args || [],
          env: targetConfig.env || {},
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const serverTools: string[] = Array.isArray(data.tools)
        ? data.tools
        : fallbackTools;

      setMcpConfigs((prev) =>
        prev.map((c) =>
          c.id === configId
            ? {
                ...c,
                tools: serverTools,
                connected: true,
                enabled: true,
                lastConnected: new Date(),
              }
            : c,
        ),
      );
      addSystemMessage(`Connected to ${targetConfig.name}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown connection error';

      setMcpConfigs((prev) =>
        prev.map((c) =>
          c.id === configId
            ? { ...c, enabled: false, connected: false }
            : c,
        ),
      );

      addSystemMessage(
        `Error connecting to ${targetConfig.name}: ${message}`,
      );
    }
  };

  const handleSelectSession = (sessionId: string | null) => {
    setSelectedSessionId(sessionId);
    if (sessionId) {
      const session = sessions.find((s) => s.id === sessionId);
      if (session) {
        // Load session messages (in real app, this would load from storage/API)
        setMessages([]);
      }
    } else {
      setMessages([]);
    }
  };

  const handleSendMessage = async (content: string, mcpId?: string) => {
    const now = Date.now();
    const userMessage: ChatMessage = {
      id: `msg-${now}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };

    const allMessages = [...messages, userMessage];

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Update session activity
    if (selectedSessionId) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === selectedSessionId
            ? { ...s, lastActivity: new Date() }
            : s
        )
      );
    }

    const connectedMcps = mcpConfigs.filter((c) => c.connected);

    try {
      let assistantContent: string | null = null;
      let responseMcpId: string | undefined;

      if (chatBackend === 'cloud-llm' && cloudLLMConfig) {
        assistantContent = await callCloudLLM(allMessages, cloudLLMConfig);
      } else if (chatBackend === 'ollama' && ollamaConfig) {
        assistantContent = await callOllama(allMessages, ollamaConfig);
      } else if (chatBackend === 'mcp') {
        const targetMcp = mcpId
          ? connectedMcps.find((m) => m.id === mcpId)
          : connectedMcps[0];

        if (!targetMcp) {
          throw new Error(
            'No connected MCP. Connect one in the sidebar first.',
          );
        }

        responseMcpId = targetMcp.id;

        const effectiveBackend: ChatBackend =
          cloudLLMConfig || ollamaConfig ? (cloudLLMConfig ? 'cloud-llm' : 'ollama') : 'mcp';

        if (effectiveBackend === 'mcp') {
          throw new Error(
            'To use MCP with LLMs, configure either a Cloud LLM or Ollama first.',
          );
        }

        assistantContent = await callMcpWithLLM({
          messages: allMessages,
          targetMcp,
          chatBackend: effectiveBackend,
          cloudLLMConfig,
          ollamaConfig,
          gatewayUrl: MCP_GATEWAY_URL,
        });
      }

      if (!assistantContent) {
        throw new Error('Model returned an empty response');
      }

      const response: ChatMessage = {
        id: `msg-${now + 1}`,
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
        mcpId: responseMcpId,
      };

      setMessages((prev) => [...prev, response]);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error while calling the chat backend';

      const response: ChatMessage = {
        id: `msg-${now + 1}`,
        role: 'assistant',
        content: `Error from chat backend: ${errorMessage}`,
        timestamp: new Date(),
        error: true,
      };

      setMessages((prev) => [...prev, response]);
    } finally {
      setIsLoading(false);
    }

    // Create new session if none selected
    if (!selectedSessionId) {
      const newSession: MCPSession = {
        id: `session-${now}`,
        name: `Chat ${format(new Date(), 'MMM d, HH:mm')}`,
        mcpIds: connectedMcps.map((c) => c.id),
        createdAt: new Date(),
        lastActivity: new Date(),
      };
      setSessions((prev) => [newSession, ...prev]);
      setSelectedSessionId(newSession.id);
    }
  };

  const connectedMcps = mcpConfigs.filter((c) => c.connected);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        mcpConfigs={mcpConfigs}
        sessions={sessions}
        selectedSessionId={selectedSessionId}
        onSelectSession={handleSelectSession}
        onAddMCP={handleAddMCP}
        onEditMCP={handleEditMCP}
        onToggleMCP={handleToggleMCP}
        onDeleteMCP={handleDeleteMCP}
      />
      <ChatPanel
        messages={messages}
        connectedMCPs={connectedMcps}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        chatBackend={chatBackend}
        onChatBackendChange={setChatBackend}
        cloudLLMConfig={cloudLLMConfig}
        onCloudLLMConfigChange={setCloudLLMConfig}
        ollamaConfig={ollamaConfig}
        onOllamaConfigChange={setOllamaConfig}
      />
      {configModalOpen && (
        <MCPConfigModal
          config={editingConfig}
          onSave={handleSaveMCP}
          onDelete={handleDeleteMCP}
          onClose={() => {
            setConfigModalOpen(false);
            setEditingConfig(null);
          }}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
