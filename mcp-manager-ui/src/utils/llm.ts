import { ChatMessage, CloudLLMConfig, OllamaConfig } from '../types';
import { MCPTool, MCPToolCall } from '../types/mcp-types';
import { mcpClientManager } from './mcp-client';

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

/**
 * Convert MCP tools to OpenAI function format
 */
const convertMCPToolsToOpenAI = (mcpTools: MCPTool[]) => {
  return mcpTools.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description || '',
      parameters: tool.inputSchema,
    },
  }));
};

/**
 * Call OpenAI with support for MCP tools
 */
const callOpenAIChat = async (
  messages: ChatMessage[],
  config: CloudLLMConfig,
  mcpTools: MCPTool[] = [],
): Promise<{ content: string; toolCalls?: MCPToolCall[] }> => {
  const baseUrl = (config.baseUrl || 'https://api.openai.com/v1').replace(
    /\/$/,
    '',
  );

  const apiKey = getCloudApiKey(config);

  // Convert chat messages to OpenAI format
  const toolSystemMessage =
    mcpTools.length > 0
      ? {
          role: 'system',
          content:
            'You have access to external MCP tools for industrial protocols (MQTT, OPC UA, etc.). ' +
            'Use these tools whenever the user asks you to read, write, browse, or call methods on field devices, PLCs, or other industrial systems, ' +
            'instead of guessing.\n\n' +
            'OPC UA NodeId reminder: numeric ids use the form ns=<namespace>;i=<integer> (for example, ns=2;i=2). ' +
            'String ids must use ns=<namespace>;s=<string> (for example, ns=2;s=TEMP_NODE_ID). ' +
            'Never put non-numeric values after i=.\n\n' +
            'Available tools:\n' +
            mcpTools
              .map(
                (tool) =>
                  `- ${tool.name}${
                    tool.description ? `: ${tool.description}` : ''
                  }`,
              )
              .join('\n'),
        }
      : null;

  const openaiMessages = [
    ...(toolSystemMessage ? [toolSystemMessage] : []),
    ...messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
  ];

  const requestBody: any = {
    model: config.model,
    messages: openaiMessages,
  };

  // Add tools if available
  if (mcpTools.length > 0) {
    requestBody.tools = convertMCPToolsToOpenAI(mcpTools);
    requestBody.tool_choice = 'auto';
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `OpenAI error (${response.status})`);
  }

  const data: any = await response.json();
  const choice = data?.choices?.[0];

  if (!choice) {
    throw new Error('OpenAI returned no choices');
  }

  // Check if the model wants to call tools
  if (choice.message?.tool_calls && choice.message.tool_calls.length > 0) {
    const toolCalls: MCPToolCall[] = [];

    // Execute each tool call
    for (const toolCall of choice.message.tool_calls) {
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments);

      // Find which MCP server has this tool
      const servers = mcpClientManager.getServers();
      let serverId: string | undefined;
      let serverName: string | undefined;

      for (const server of servers) {
        if (server.tools?.some(t => t.name === functionName)) {
          serverId = server.id;
          serverName = server.name;
          break;
        }
      }

      if (!serverId || !serverName) {
        console.error(`Tool ${functionName} not found in any connected MCP server`);
        continue;
      }

      // Execute the tool
      const result = await mcpClientManager.callTool(serverId, functionName, functionArgs);

      toolCalls.push({
        id: toolCall.id,
        toolName: functionName,
        serverId,
        serverName,
        arguments: functionArgs,
        result,
        timestamp: new Date(),
      });
    }

    // Format tool results as text for the response
    const toolResultsText = toolCalls
      .map(tc => {
        const resultText = tc.result?.content?.[0]?.text || JSON.stringify(tc.result);
        return `Tool ${tc.toolName} result: ${resultText}`;
      })
      .join('\n\n');

    return {
      content: toolResultsText || 'Tools executed successfully',
      toolCalls,
    };
  }

  // No tool calls, return regular response
  const content = choice.message?.content?.toString().trim() || '';

  if (!content) {
    throw new Error('OpenAI returned an empty response');
  }

  return { content };
};


/**
 * Get all available MCP tools from connected servers
 */
const getAllMCPTools = (): MCPTool[] => {
  const allTools: MCPTool[] = [];
  const servers = mcpClientManager.getServers();

  for (const server of servers) {
    if (server.status === 'connected' && server.tools) {
      allTools.push(...server.tools);
    }
  }

  return allTools;
};

const callGemini = async (
  messages: ChatMessage[],
  config: CloudLLMConfig,
): Promise<{ content: string; toolCalls?: MCPToolCall[] }> => {
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

  return { content };
};

const callAnthropic = async (
  messages: ChatMessage[],
  config: CloudLLMConfig,
): Promise<{ content: string; toolCalls?: MCPToolCall[] }> => {
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

  return { content };
};

export const callCloudLLM = async (
  messages: ChatMessage[],
  config: CloudLLMConfig,
): Promise<{ content: string; toolCalls?: MCPToolCall[] }> => {
  // Get available MCP tools
  const mcpTools = getAllMCPTools();

  switch (config.provider) {
    case 'openai':
      return callOpenAIChat(messages, config, mcpTools);
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
