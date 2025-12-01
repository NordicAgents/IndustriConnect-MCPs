import { useState, useRef, useEffect } from 'react';
import {
  ArrowUp,
  Loader2,
  User,
  Sparkle,
  Copy,
  CheckCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  ChatMessage,
  ChatBackend,
  CloudLLMConfig,
  OllamaConfig,
} from '../types';
import { format } from 'date-fns';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  chatBackend: ChatBackend;
  onChatBackendChange: (backend: ChatBackend) => void;
  cloudLLMConfig: CloudLLMConfig | null;
  onCloudLLMConfigChange: (config: CloudLLMConfig | null) => void;
  ollamaConfig: OllamaConfig | null;
  onOllamaConfigChange: (config: OllamaConfig | null) => void;
}

export default function ChatPanel({
  messages,
  onSendMessage,
  isLoading = false,
  chatBackend,
  onChatBackendChange,
  cloudLLMConfig,
  onCloudLLMConfigChange,
  ollamaConfig,
  onOllamaConfigChange,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [isLoadingOllamaModels, setIsLoadingOllamaModels] = useState(false);
  const [ollamaError, setOllamaError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeCloudProvider = cloudLLMConfig?.provider || 'openai';
  const envCloudApiKey =
    activeCloudProvider === 'openai'
      ? (import.meta.env.VITE_OPENAI_API_KEY as string | undefined)
      : activeCloudProvider === 'gemini'
        ? (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)
        : (import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined);
  const isCloudConfigured = Boolean(
    cloudLLMConfig?.model && (cloudLLMConfig?.apiKey || envCloudApiKey),
  );
  const isOllamaConfigured = Boolean(
    (ollamaConfig?.baseUrl || 'http://localhost:11434') && ollamaConfig?.model,
  );

  const canSend =
    chatBackend === 'cloud-llm' ? isCloudConfigured : isOllamaConfigured;

  const effectiveOllamaBaseUrl =
    ollamaConfig?.baseUrl || 'http://localhost:11434';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchOllamaModels = async (baseUrl: string) => {
    setIsLoadingOllamaModels(true);
    setOllamaError(null);

    try {
      const url = baseUrl.replace(/\/$/, '') + '/api/tags';
      const response = await fetch(url);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }
      const data: any = await response.json();
      const models: string[] =
        Array.isArray(data?.models) && data.models.length > 0
          ? data.models
              .map((model: any) => model?.name)
              .filter((name: unknown): name is string => typeof name === 'string')
          : [];

      setOllamaModels(models);

      if (models.length > 0) {
        const currentModel = ollamaConfig?.model || models[0];
        onOllamaConfigChange({
          baseUrl,
          model: currentModel,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to load models from Ollama';
      setOllamaError(
        `Could not load models from Ollama at ${baseUrl}: ${message}`,
      );
      setOllamaModels([]);
    } finally {
      setIsLoadingOllamaModels(false);
    }
  };

  useEffect(() => {
    if (chatBackend !== 'ollama') return;
    fetchOllamaModels(effectiveOllamaBaseUrl);
    // We only want to refetch when backend or base URL changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatBackend, effectiveOllamaBaseUrl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !canSend) return;

    onSendMessage(input.trim());
    setInput('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleCopy = async (content: string, messageId: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(messageId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExamplePrompt = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [input]);

  const CLOUD_MODEL_OPTIONS: Record<
    CloudLLMConfig['provider'],
    string[]
  > = {
    openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],
    gemini: ['gemini-1.5-flash', 'gemini-1.5-pro'],
    anthropic: ['claude-3-5-sonnet', 'claude-3-opus', 'claude-3-haiku'],
  };

  const examplePrompts = [
    'Explain this piece of code',
    'Summarize the key points from a document',
    'Help me debug a configuration issue',
    'Suggest test cases for this feature',
  ];

  const inputPlaceholder =
    chatBackend === 'cloud-llm'
      ? isCloudConfigured
        ? 'Ask the cloud model anything... (Enter to send, Shift+Enter for new line)'
        : envCloudApiKey
          ? 'Select provider and model above to start chatting...'
          : 'Select provider, model and API key above to start chatting...'
      : 'Ask the local Ollama model anything... (Enter to send, Shift+Enter for new line)';

  return (
    <div className="flex-1 flex flex-col h-screen bg-gradient-to-b from-background to-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-3.5 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                LLM Chat
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Chat with cloud or local LLMs
              </p>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Zap className="w-3 h-3 text-primary" />
            <span className="font-medium text-muted-foreground">Chat backend</span>
            <select
              value={chatBackend}
              onChange={(e) =>
                onChatBackendChange(e.target.value as ChatBackend)
              }
              className="px-2 py-1 border border-border rounded-md bg-background hover:bg-accent/30 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="cloud-llm">Cloud LLM (ChatGPT / Gemini / Claude)</option>
              <option value="ollama">Local Ollama</option>
            </select>
          </div>

          {chatBackend === 'cloud-llm' && (
            <>
              {(() => {
                const provider = cloudLLMConfig?.provider || 'openai';
                const modelOptions = CLOUD_MODEL_OPTIONS[provider] || [];
                const currentModel =
                  cloudLLMConfig?.model || modelOptions[0] || '';
                return (
                  <>
                    <select
                      value={provider}
                      onChange={(e) => {
                        const newProvider =
                          e.target.value as CloudLLMConfig['provider'];
                        const options =
                          CLOUD_MODEL_OPTIONS[newProvider] || [];
                        onCloudLLMConfigChange({
                          provider: newProvider,
                          apiKey: cloudLLMConfig?.apiKey || '',
                          model: options[0] || '',
                          baseUrl: cloudLLMConfig?.baseUrl,
                        });
                      }}
                      className="px-2 py-1 border border-border rounded-md bg-background hover:bg-accent/30 focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="openai">ChatGPT (OpenAI)</option>
                      <option value="gemini">Gemini (Google)</option>
                      <option value="anthropic">Claude (Anthropic)</option>
                    </select>
                    <select
                      value={currentModel}
                      onChange={(e) =>
                        onCloudLLMConfigChange({
                          provider,
                          apiKey: cloudLLMConfig?.apiKey || '',
                          model: e.target.value,
                          baseUrl: cloudLLMConfig?.baseUrl,
                        })
                      }
                      className="px-2 py-1 border border-border rounded-md bg-background hover:bg-accent/30 focus:outline-none focus:ring-1 focus:ring-ring text-xs min-w-[180px]"
                    >
                      {modelOptions.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </>
                );
              })()}
              {!envCloudApiKey && (
                <input
                  type="text"
                  value={cloudLLMConfig?.apiKey || ''}
                  onChange={(e) =>
                    onCloudLLMConfigChange({
                      provider: cloudLLMConfig?.provider || 'openai',
                      apiKey: e.target.value,
                      model: cloudLLMConfig?.model || '',
                      baseUrl: cloudLLMConfig?.baseUrl,
                    })
                  }
                  placeholder="API key"
                  className="px-2 py-1 border border-border rounded-md bg-input focus:outline-none focus:ring-1 focus:ring-ring text-xs min-w-[180px]"
                />
              )}
            </>
          )}

          {chatBackend === 'ollama' && (
            <>
              <input
                type="text"
                value={effectiveOllamaBaseUrl}
                onChange={(e) =>
                  onOllamaConfigChange({
                    baseUrl: e.target.value,
                    model: ollamaConfig?.model || '',
                  })
                }
                placeholder="Ollama URL (e.g., http://localhost:11434)"
                className="px-2 py-1 border border-border rounded-md bg-input focus:outline-none focus:ring-1 focus:ring-ring text-xs min-w-[200px]"
              />
              <select
                value={ollamaConfig?.model || ''}
                onChange={(e) =>
                  onOllamaConfigChange({
                    baseUrl: effectiveOllamaBaseUrl,
                    model: e.target.value,
                  })
                }
                className="px-2 py-1 border border-border rounded-md bg-background hover:bg-accent/30 focus:outline-none focus:ring-1 focus:ring-ring text-xs min-w-[160px]"
              >
                <option value="">
                  {isLoadingOllamaModels
                    ? 'Loading models...'
                    : 'Select Ollama model'}
                </option>
                {ollamaModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => fetchOllamaModels(effectiveOllamaBaseUrl)}
                className="px-2 py-1 border border-border rounded-md bg-background hover:bg-accent/30 focus:outline-none focus:ring-1 focus:ring-ring text-xs"
              >
                Refresh models
              </button>
            </>
          )}

          {ollamaError && chatBackend === 'ollama' && (
            <span className="text-[11px] text-destructive">
              {ollamaError}
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-2xl">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Ask questions, brainstorm ideas, or get help from cloud and local language models.
              </p>

              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Try these examples:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {examplePrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => handleExamplePrompt(prompt)}
                      className="text-left px-4 py-3 text-sm border border-border rounded-lg hover:bg-accent/50 hover:border-primary/50 transition-all group flex items-start gap-2"
                    >
                      <Zap className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                        {prompt}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 max-w-4xl mx-auto">
            {messages.map((message, index) => {
              const isUser = message.role === 'user';
              const isSystem = message.role === 'system';
              const showAvatar = index === 0 || messages[index - 1]?.role !== message.role;

              return (
                <div
                  key={message.id}
                  className={`flex gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Avatar */}
                  {showAvatar && (
                    <div className={`flex-shrink-0 ${isUser ? 'order-2' : 'order-1'}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isUser
                        ? 'bg-primary text-primary-foreground'
                        : isSystem
                          ? 'bg-muted/50 text-muted-foreground'
                          : 'bg-accent text-accent-foreground border border-border'
                        }`}>
                        {isUser ? <User className="w-5 h-5" /> : <Sparkle className="w-4 h-4" />}
                      </div>
                    </div>
                  )}
                  {!showAvatar && <div className="w-8 flex-shrink-0" />}

                  {/* Message Bubble */}
                  <div className={`flex-1 group ${isUser ? 'flex justify-end' : 'flex justify-start'}`}>
                    <div className={`max-w-[85%] ${isUser ? 'order-1' : 'order-2'}`}>
                      <div className="relative">
                        <div
                          className={`rounded-2xl px-4 py-3 ${isUser
                            ? 'bg-primary text-primary-foreground shadow-md'
                            : isSystem
                              ? 'bg-muted/30 text-muted-foreground text-sm border border-border/50'
                              : message.error
                                ? 'bg-destructive/10 text-destructive border border-destructive/20'
                                : 'bg-accent/50 border border-border/50 shadow-sm'
                            }`}
                        >
                          <div className="whitespace-pre-wrap text-sm leading-relaxed break-words">
                            {message.content}
                          </div>

                          {/* Timestamp and Actions */}
                          <div className={`flex items-center gap-2 mt-2 ${isUser ? 'justify-end' : 'justify-between'
                            }`}>
                            <span className={`text-xs ${isUser ? 'opacity-70' : 'opacity-50'
                              }`}>
                              {format(message.timestamp, 'HH:mm')}
                            </span>

                            {!isUser && !isSystem && (
                              <button
                                onClick={() => handleCopy(message.content, message.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-background/50 rounded"
                                title="Copy message"
                              >
                                {copiedId === message.id ? (
                                  <CheckCheck className="w-3 h-3 text-green-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing Indicator */}
            {isLoading && (
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-accent text-accent-foreground border border-border flex items-center justify-center flex-shrink-0">
                  <Sparkle className="w-4 h-4" />
                </div>
                <div className="bg-accent/50 border border-border/50 rounded-2xl px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border px-6 py-4 bg-background/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="relative">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={inputPlaceholder}
                disabled={isLoading || !canSend}
                className="w-full min-h-[56px] max-h-[200px] pl-4 pr-14 py-3 border border-border rounded-xl bg-input resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-all shadow-sm"
                rows={1}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading || !canSend}
                className="absolute right-2 bottom-2 p-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg disabled:shadow-none"
                title="Send message"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowUp className="w-4 h-4" />
                )}
              </button>
            </div>
            {chatBackend === 'cloud-llm' && !isCloudConfigured && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {envCloudApiKey
                  ? 'Set the provider and model above to begin chatting with a cloud LLM.'
                  : 'Set the provider, model, and API key above to begin chatting with a cloud LLM.'}
              </p>
            )}
            {chatBackend === 'ollama' && !isOllamaConfigured && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Make sure Ollama is running locally and select a model above to begin.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
