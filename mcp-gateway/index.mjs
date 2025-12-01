import express from 'express';
import cors from 'cors';
import { McpClient } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';

const app = express();
const port = process.env.MCP_GATEWAY_PORT || 8787;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

/**
 * In-memory registry of running MCP servers.
 * Keyed by the UI's MCP config id.
 */
const servers = new Map();

function normalizeEnv(env) {
  if (!env || typeof env !== 'object') {
    return process.env;
  }
  return {
    ...process.env,
    ...env,
  };
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/mcp/connect', async (req, res) => {
  const { id, name, command, args = [], env = {} } = req.body || {};

  if (!id || !command) {
    return res
      .status(400)
      .json({ ok: false, error: 'Missing required fields: id, command' });
  }

  if (servers.has(id)) {
    // Already connected; refresh tool list
    try {
      const { client } = servers.get(id);
      const toolsResponse = await client.listTools();
      const tools = (toolsResponse.tools || []).map((t) => t.name);
      return res.json({ ok: true, alreadyConnected: true, tools });
    } catch (error) {
      console.error('Error listing tools for existing server', error);
      return res.json({ ok: true, alreadyConnected: true, tools: [] });
    }
  }

  try {
    const transport = new StdioClientTransport({
      command,
      args,
      env: normalizeEnv(env),
    });

    const client = new McpClient(transport);
    await client.connect();

    const toolsResponse = await client.listTools();
    const tools = (toolsResponse.tools || []).map((t) => t.name);

    servers.set(id, {
      id,
      name,
      command,
      args,
      env,
      client,
      transport,
    });

    res.json({ ok: true, tools });
  } catch (error) {
    console.error('Error connecting to MCP server', error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to connect MCP',
    });
  }
});

app.post('/mcp/disconnect', async (req, res) => {
  const { id } = req.body || {};
  if (!id) {
    return res.status(400).json({ ok: false, error: 'Missing id' });
  }

  const entry = servers.get(id);
  if (!entry) {
    return res.json({ ok: true, alreadyStopped: true });
  }

  try {
    await entry.client.close();
  } catch (error) {
    console.warn('Error closing MCP client', error);
  }

  try {
    await entry.transport.close();
  } catch (error) {
    console.warn('Error closing MCP transport', error);
  }

  servers.delete(id);
  res.json({ ok: true });
});

app.get('/mcp/:id/tools', async (req, res) => {
  const id = req.params.id;
  const entry = servers.get(id);
  if (!entry) {
    return res.status(404).json({ ok: false, error: 'MCP server not connected' });
  }

  try {
    const toolsResponse = await entry.client.listTools();
    const tools = toolsResponse.tools || [];
    res.json({
      ok: true,
      tools: tools.map((t) => t.name),
      rawTools: tools,
    });
  } catch (error) {
    console.error('Error listing tools', error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to list tools',
    });
  }
});

app.post('/mcp/:id/call-tool', async (req, res) => {
  const id = req.params.id;
  const { toolName, arguments: toolArgs = {} } = req.body || {};

  if (!toolName) {
    return res.status(400).json({ ok: false, error: 'Missing toolName' });
  }

  const entry = servers.get(id);
  if (!entry) {
    return res.status(404).json({ ok: false, error: 'MCP server not connected' });
  }

  try {
    const result = await entry.client.callTool({
      name: toolName,
      arguments: toolArgs,
    });
    res.json({ ok: true, result });
  } catch (error) {
    console.error('Error calling tool', error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to call tool',
    });
  }
});

app.listen(port, () => {
  console.log(`MCP gateway listening on http://localhost:${port}`);
});

