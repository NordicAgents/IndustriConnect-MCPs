import { useState, useEffect } from 'react';
import { ThemeProvider } from './components/ThemeProvider';
import Sidebar from './components/Sidebar';
import ChatPanel from './components/ChatPanel';
import {
  ChatMessage,
  ChatSession,
  ChatBackend,
  CloudLLMConfig,
  OllamaConfig,
} from './types';
import {
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

function AppContent() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chatBackend, setChatBackend] = useState<ChatBackend>('cloud-llm');
  const [cloudLLMConfig, setCloudLLMConfig] = useState<CloudLLMConfig | null>(
    null,
  );
  const [ollamaConfig, setOllamaConfig] = useState<OllamaConfig | null>(null);

  // Load data from localStorage on mount
  useEffect(() => {
    const loadedSessions = loadSessions();
    const loadedChatBackend = loadChatBackend();
    const loadedCloudConfig = loadCloudLLMConfig();
    const loadedOllamaConfig = loadOllamaConfig();

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

  const handleSelectSession = (sessionId: string | null) => {
    setSelectedSessionId(sessionId);
    // In this simplified UI we clear messages when switching sessions.
    setMessages([]);
  };

  const handleSendMessage = async (content: string) => {
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
            : s,
        ),
      );
    }

    try {
      let assistantContent: string | null = null;

      if (chatBackend === 'cloud-llm' && cloudLLMConfig) {
        assistantContent = await callCloudLLM(allMessages, cloudLLMConfig);
      } else if (chatBackend === 'ollama' && ollamaConfig) {
        assistantContent = await callOllama(allMessages, ollamaConfig);
      } else {
        throw new Error('Chat backend is not configured.');
      }

      if (!assistantContent) {
        throw new Error('Model returned an empty response');
      }

      const response: ChatMessage = {
        id: `msg-${now + 1}`,
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
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
      const newSession: ChatSession = {
        id: `session-${now}`,
        name: `Chat ${format(new Date(), 'MMM d, HH:mm')}`,
        createdAt: new Date(),
        lastActivity: new Date(),
      };
      setSessions((prev) => [newSession, ...prev]);
      setSelectedSessionId(newSession.id);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        sessions={sessions}
        selectedSessionId={selectedSessionId}
        onSelectSession={handleSelectSession}
      />
      <ChatPanel
        messages={messages}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        chatBackend={chatBackend}
        onChatBackendChange={setChatBackend}
        cloudLLMConfig={cloudLLMConfig}
        onCloudLLMConfigChange={setCloudLLMConfig}
        ollamaConfig={ollamaConfig}
        onOllamaConfigChange={setOllamaConfig}
      />
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
