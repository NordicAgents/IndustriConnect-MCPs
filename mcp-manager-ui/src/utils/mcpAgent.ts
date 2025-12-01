import {
  ChatBackend,
  ChatMessage,
  CloudLLMConfig,
  MCPConfig,
  OllamaConfig,
} from '../types';
import { callCloudLLM, callOllama } from './llm';

const extractJsonObject = (text: string): any => {
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) {
    throw new Error('LLM did not return a JSON object.');
  }

  const candidate = text.slice(first, last + 1);
  return JSON.parse(candidate);
};

const extractTextFromToolResult = (result: any): string => {
  if (result && Array.isArray(result.content)) {
    const parts = result.content
      .filter(
        (part: any) =>
          part &&
          (part.type === 'text' || part.type === 'output_text') &&
          typeof part.text === 'string',
      )
      .map((part: any) => part.text);

    if (parts.length > 0) {
      return parts.join('\n');
    }
  }

  return JSON.stringify(result, null, 2);
};

interface CallMcpWithLlmArgs {
  messages: ChatMessage[];
  targetMcp: MCPConfig;
  chatBackend: ChatBackend;
  cloudLLMConfig: CloudLLMConfig | null;
  ollamaConfig: OllamaConfig | null;
  gatewayUrl: string;
}

export const callMcpWithLLM = async ({
  messages,
  targetMcp,
  chatBackend,
  cloudLLMConfig,
  ollamaConfig,
  gatewayUrl,
}: CallMcpWithLlmArgs): Promise<string> => {
  if (chatBackend !== 'cloud-llm' && chatBackend !== 'ollama') {
    throw new Error(
      'MCP + LLM requires either a cloud LLM or Ollama to be configured.',
    );
  }

  const toolsResponse = await fetch(
    `${gatewayUrl.replace(/\/$/, '')}/mcp/${encodeURIComponent(
      targetMcp.id,
    )}/tools`,
  );

  if (!toolsResponse.ok) {
    const text = await toolsResponse.text();
    throw new Error(text || `Failed to load tools for MCP (${toolsResponse.status})`);
  }

  const toolsData: any = await toolsResponse.json();
  const rawTools: any[] = Array.isArray(toolsData.rawTools)
    ? toolsData.rawTools
    : [];

  const systemMessage: ChatMessage = {
    id: `sys-${Date.now()}`,
    role: 'system',
    content: [
      'You are an assistant that decides which MCP tool to call.',
      `You are connected to MCP server "${targetMcp.name}" of type "${targetMcp.type}".`,
      'You have access to the following tools (from the Model Context Protocol server).',
      'Each tool has a name, description, and JSON Schema input:',
      JSON.stringify(rawTools, null, 2),
      '',
      'Based on the user request and these tools, choose EXACTLY ONE tool to call and provide valid JSON arguments.',
      'Respond with ONLY a single JSON object, no explanation, in this shape:',
      '{ "toolName": "<tool-name>", "arguments": { ... } }',
    ].join('\n'),
    timestamp: new Date(),
  };

  const llmMessages: ChatMessage[] = [systemMessage, ...messages];

  const llmRawResponse =
    chatBackend === 'cloud-llm'
      ? await callCloudLLM(llmMessages, cloudLLMConfig as CloudLLMConfig)
      : await callOllama(llmMessages, ollamaConfig as OllamaConfig);

  const parsed = extractJsonObject(llmRawResponse);
  const toolName: string = parsed.toolName || parsed.tool || parsed.name;
  const toolArgs: Record<string, unknown> = parsed.arguments || parsed.args || {};

  if (!toolName || typeof toolName !== 'string') {
    throw new Error('LLM did not specify a valid toolName.');
  }

  const callResponse = await fetch(
    `${gatewayUrl.replace(/\/$/, '')}/mcp/${encodeURIComponent(
      targetMcp.id,
    )}/call-tool`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        toolName,
        arguments: toolArgs,
      }),
    },
  );

  if (!callResponse.ok) {
    const text = await callResponse.text();
    throw new Error(text || `Tool call failed (${callResponse.status})`);
  }

  const callData: any = await callResponse.json();

  if (!callData.ok) {
    throw new Error(callData.error || 'MCP tool call reported an error.');
  }

  const resultText = extractTextFromToolResult(callData.result);

  return `Tool ${toolName} result:\n${resultText}`;
};

