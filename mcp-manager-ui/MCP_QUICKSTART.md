# MCP Server Integration Quick Start

This guide helps you quickly get started with MCP (Model Context Protocol) server integration in the LLM Chat UI.

## What is MCP?

MCP (Model Context Protocol) allows LLMs to interact with external systems through "tools". For example, an MQTT MCP server provides tools to publish/subscribe to MQTT topics, while an OPC UA MCP server provides tools to read/write PLC data.

## Quick Setup

### 1. Configure Your MCP Servers

You have three options:

**Option A: Import from File**
1. Click "Configure Servers" in the sidebar
2. Click "Import File"
3. Select `mcp-config-example.json` from this directory

**Option B: Import from JSON**
1. Click "Configure Servers"
2. Switch to "JSON Editor" mode
3. Paste the example configuration from `mcp-config-example.json`
4. Click "Apply JSON Configuration"

**Option C: Manual Form Entry**
1. Click "Configure Servers"
2. Fill in the form:
   - **Server Name**: `MQTT MCP (Python)`
   - **Command**: `uv`
   - **Arguments** (one per line):
     ```
     --directory
     /Users/mx/Documents/IndustriConnect-MCPs/MQTT-Project/mqtt-python
     run
     mqtt-mcp
     ```
   - **Environment Variables**:
     ```json
     {
       "MQTT_BROKER_URL": "mqtt://127.0.0.1:1883",
       "MQTT_CLIENT_ID": "mqtt-mcp-cursor"
     }
     ```
3. Click "Add Server"

### 2. Start Your MCP Servers

**Important**: This UI runs in the browser and cannot spawn server processes automatically. You must start your MCP servers manually.

For MQTT MCP server:
```bash
cd /Users/mx/Documents/IndustriConnect-MCPs/MQTT-Project/mqtt-python
uv run mqtt-mcp
```

For OPC UA MCP server:
```bash
cd /Users/mx/Documents/IndustriConnect-MCPs/OPCUA-Project/opcua-mcp-server
uv run opcua-mcp-server.py
```

### 3. Connect in the UI

1. In the sidebar, expand "MCP Servers"
2. Click "Connect" next to your server
3. Wait for the status to turn green
4. Expand the server to view available tools

### 4. Use MCP Tools in Chat

Once connected, you can reference MCP capabilities in your chat:
- "List all available MCP tools"
- "Publish 'hello world' to MQTT topic 'test'"
- "Read the temperature value from OPC UA node ns=2;s=Temperature"

## Current Implementation Status

✅ **Implemented:**
- MCP server configuration UI (form & JSON)
- Import/Export Cursor-style configuration
- Server connection management
- Tool listing and display
- Persistent configuration storage

⏳ **Simulated (Mock):**
- Actual MCP server communication (currently shows mock tools)
- Tool execution (returns mock responses)

🔜 **Future Enhancements:**
- Real MCP server communication via WebSocket/HTTP
- Backend service to spawn and manage MCP processes
- Actual tool execution with real results
- Tool call integration in LLM responses

## Troubleshooting

**Server won't connect:**
- Ensure the MCP server process is running
- Check that paths in configuration are correct
- Verify environment variables are set properly

**No tools showing:**
- Make sure the server status is "connected" (green)
- Click the expand arrow next to the server name
- Check browser console for errors

**Configuration not saving:**
- Check browser localStorage is enabled
- Try exporting and re-importing the configuration

## Example Configuration Format

The configuration follows Cursor IDE's format:

```json
{
  "mcpServers": {
    "Server Name": {
      "command": "executable_name",
      "args": ["arg1", "arg2"],
      "env": {
        "ENV_VAR": "value"
      }
    }
  }
}
```

For more examples, see `mcp-config-example.json`.
