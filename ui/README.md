# MCP Manager UI

A modern, intuitive interface for configuring and connecting multiple Model Context Protocol (MCP) servers in the IndustriConnect ecosystem. Built with React, TypeScript, and Tailwind CSS.

## Features

- 🎨 **Beautiful UI** - Modern interface inspired by Claude Code with clean design
- 🌓 **Dark/Light Mode** - Seamless theme switching with system preference detection
- 🔌 **Multiple MCP Support** - Configure and manage multiple industrial protocol MCPs:
  - BACnet
  - DNP3
  - EtherCAT
  - EtherNet/IP
  - MODBUS
  - MQTT (with Sparkplug B)
  - OPC UA
  - PROFIBUS
  - PROFINET
  - S7comm
- 💬 **Interactive Chat** - Chat with connected MCPs and send commands
- 📝 **Session Management** - Track and manage conversation sessions
- 💾 **Local Storage** - Persistent configuration and session history

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
cd mcp-manager-ui
npm install
```

### Development

```bash
npm run dev
```

The application will open at `http://localhost:3000`

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Usage

1. **Add an MCP Configuration**
   - Click "Add MCP" in the sidebar
   - Select the protocol type
   - Configure connection settings (host, port, etc.)
   - Save the configuration

2. **Connect to an MCP**
   - Click the zap icon next to an MCP configuration to connect
   - Connected MCPs will show a green indicator

3. **Start Chatting**
   - Select or create a session
   - Type messages in the chat panel
   - Choose to message all MCPs or a specific one
   - Send commands and interact with your industrial protocol servers

4. **Manage Sessions**
   - View all your conversation sessions in the sidebar
   - Click on a session to view its history
   - Sessions are automatically created when you start chatting

## Project Structure

```
mcp-manager-ui/
├── src/
│   ├── components/        # React components
│   │   ├── Sidebar.tsx    # Left sidebar with configs and sessions
│   │   ├── ChatPanel.tsx  # Right panel for chat interface
│   │   ├── MCPConfigModal.tsx  # Modal for configuring MCPs
│   │   └── ThemeProvider.tsx   # Theme context provider
│   ├── data/              # Static data and templates
│   │   └── mcpTemplates.ts    # MCP type definitions and defaults
│   ├── types.ts           # TypeScript type definitions
│   ├── utils/             # Utility functions
│   │   ├── theme.ts       # Theme management
│   │   └── storage.ts     # LocalStorage helpers
│   ├── App.tsx            # Main application component
│   └── main.tsx           # Entry point
├── index.html
├── package.json
└── vite.config.ts
```

## Customization

### Adding a New MCP Type

1. Add the MCP type to `src/types.ts` in the `MCPType` union
2. Add configuration template in `src/data/mcpTemplates.ts`:
   - Add to `MCP_TYPES` array
   - Add default environment variables in `getDefaultEnvForType`

## Future Enhancements

- [ ] Real MCP server connection (currently simulated)
- [ ] WebSocket-based communication with MCP servers
- [ ] Export/import configurations
- [ ] Command history and autocomplete
- [ ] Multi-tab support for multiple sessions
- [ ] Real-time MCP status monitoring
- [ ] Logs viewer for MCP communications

## License

ISC
