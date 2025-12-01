# Quick Start Guide

## Installation

```bash
cd mcp-manager-ui
npm install
```

## Running the Application

```bash
npm run dev
```

The application will automatically open in your browser at `http://localhost:3000`.

## First Steps

1. **Add Your First MCP Configuration**
   - Click the "Add MCP" button in the sidebar
   - Select a protocol type (e.g., MODBUS, MQTT, OPC UA)
   - Configure the connection settings:
     - For MODBUS: Set host (127.0.0.1), port (502), and slave ID
     - For MQTT: Set broker URL, client ID, and Sparkplug settings
     - For OPC UA: Set server URL
   - Click "Save"

2. **Connect to an MCP**
   - Hover over an MCP configuration in the sidebar
   - Click the zap icon (⚡) to connect
   - Wait for the connection indicator (green dot)

3. **Start Chatting**
   - Once connected, you can start typing messages in the chat panel
   - Select "All MCPs" or a specific MCP from the dropdown
   - Type your message and press Enter to send
   - Responses will appear in the chat

4. **Manage Sessions**
   - Sessions are automatically created when you start chatting
   - View all sessions in the sidebar under "Sessions"
   - Click on a session to view its history

5. **Toggle Dark/Light Mode**
   - Click the moon/sun icon in the top-right of the sidebar
   - The theme preference is saved automatically

## Features Overview

- ✅ Configure multiple MCP servers
- ✅ Connect/disconnect from MCPs
- ✅ Chat with connected MCPs
- ✅ Session management
- ✅ Dark/light mode
- ✅ Persistent storage (localStorage)

## Troubleshooting

**Application won't start:**
- Ensure Node.js 18+ is installed: `node --version`
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`

**Can't connect to MCP:**
- Verify the MCP server is running
- Check connection settings (host, port, etc.)
- Ensure the MCP command is correct (e.g., `npx`, `modbus-mcp`)

**Theme not working:**
- Clear browser cache and reload
- Check browser console for errors

## Next Steps

- Integrate with actual MCP servers
- Add WebSocket support for real-time communication
- Implement command autocomplete
- Add export/import functionality
