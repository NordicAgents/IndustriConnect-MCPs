import { ChatMessage, CloudLLMConfig, OllamaConfig } from '../types';

const buildPromptFromMessages = (messages: ChatMessage[]): string => {
  const sorted = [...messages].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );

  return sorted
    .map((message) => {
      const label =
        message.role === 'user'
          ? 'User'
          : message.role === 'assistant'
            ? 'Assistant'
            : 'System';
      return `${label}: ${message.content}`;
    })
    .join('\n\n');
};

const getCloudApiKey = (config: CloudLLMConfig): string => {
  if (config.apiKey) {
    return config.apiKey;
  }

  let envKey: string | undefined;
  if (config.provider === 'openai') {
    envKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;
  } else if (config.provider === 'gemini') {
    envKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  } else if (config.provider === 'anthropic') {
    envKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
  }

  if (!envKey) {
    throw new Error(
      'No API key configured. Set it in a .env file (VITE_OPENAI_API_KEY / VITE_GEMINI_API_KEY / VITE_ANTHROPIC_API_KEY) or enter it in the UI.',
    );
  }

  return envKey;
};

const callOpenAIChat = async (
  messages: ChatMessage[],
  config: CloudLLMConfig,
): Promise<string> => {
  const prompt = buildPromptFromMessages(messages);
  const baseUrl = (config.baseUrl || 'https://api.openai.com/v1').replace(
    /\/$/,
    '',
  );

  const apiKey = getCloudApiKey(config);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `OpenAI error (${response.status})`);
  }

  const data: any = await response.json();
  const content =
    data?.choices?.[0]?.message?.content?.toString().trim() || '';

  if (!content) {
    throw new Error('OpenAI returned an empty response');
  }

  return content;
};

const callGemini = async (
  messages: ChatMessage[],
  config: CloudLLMConfig,
): Promise<string> => {
  const prompt = buildPromptFromMessages(messages);
  const apiKey = getCloudApiKey(config);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    config.model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Gemini error (${response.status})`);
  }

  const data: any = await response.json();
  const parts: string[] =
    data?.candidates?.[0]?.content?.parts
      ?.map((part: any) => part?.text)
      .filter(Boolean) || [];
  const content = parts.join(' ').trim();

  if (!content) {
    throw new Error('Gemini returned an empty response');
  }

  return content;
};

const callAnthropic = async (
  messages: ChatMessage[],
  config: CloudLLMConfig,
): Promise<string> => {
  const prompt = buildPromptFromMessages(messages);
  const apiKey = getCloudApiKey(config);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Anthropic error (${response.status})`);
  }

  const data: any = await response.json();
  const content =
    data?.content?.[0]?.text?.toString().trim() ||
    data?.content?.[0]?.content?.toString().trim() ||
    '';

  if (!content) {
    throw new Error('Anthropic returned an empty response');
  }

  return content;
};

export const callCloudLLM = async (
  messages: ChatMessage[],
  config: CloudLLMConfig,
): Promise<string> => {
  switch (config.provider) {
    case 'openai':
      return callOpenAIChat(messages, config);
    case 'gemini':
      return callGemini(messages, config);
    case 'anthropic':
      return callAnthropic(messages, config);
    default:
      throw new Error(`Unsupported cloud provider: ${config.provider}`);
  }
};

export const callOllama = async (
  messages: ChatMessage[],
  config: OllamaConfig,
): Promise<string> => {
  const baseUrl = (config.baseUrl || 'http://localhost:11434').replace(
    /\/$/,
    '',
  );

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      stream: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Ollama error (${response.status})`);
  }

  const data: any = await response.json();
  const content = data?.message?.content?.toString().trim() || '';

  if (!content) {
    throw new Error('Ollama returned an empty response');
  }

  return content;
};
