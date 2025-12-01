# LLM Chat UI

A modern, intuitive chat interface for working with local and third‑party language models in the IndustriConnect ecosystem. Built with React, TypeScript, and Tailwind CSS.

## Features

- 🎨 **Beautiful UI** – Modern interface inspired by Claude Code with clean design  
- 🌓 **Dark/Light Mode** – Seamless theme switching with system preference detection  
- 🔌 **MCP Server Integration** – Connect and manage Model Context Protocol servers (MQTT, OPC UA, etc.)
- ☁️ **Cloud LLM Support** – Talk to OpenAI (ChatGPT), Google Gemini, and Anthropic Claude  
- 💻 **Local LLM Support (Ollama)** – Chat with local models running via Ollama  
- 💬 **Interactive Chat** – Streaming‑style conversational UI with copy‑to‑clipboard  
- 📝 **Session Management** – Simple session list to keep track of conversations  
- 💾 **Local Storage** – Remembers chat backend and LLM configuration between visits

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Python (for running MCP servers like MQTT/OPC UA)
- `uv` (Python package manager)

### Installation

1. Install dependencies (including backend):
   ```bash
   npm install
   cd mcp-backend && npm install && cd ..
   ```

### Running the Application

Start both the frontend UI and the backend service with a single command:

```bash
npm run dev
```

This will start:
- Frontend UI at http://localhost:5173 (or similar)
- Backend WebSocket server at ws://localhost:3003
- Backend HTTP server at http://localhost:3002

## Features

- **Chat Interface**: Interact with Cloud LLMs (OpenAI, Gemini, Anthropic) or local Ollama models.
- **MCP Server Integration**: Configure and connect to real MCP servers (MQTT, OPC UA, etc.).
- **Tool Calling**: LLMs can automatically discover and use tools provided by connected MCP servers.
- **Real-time Updates**: WebSocket connection ensures live status updates from MCP servers.

## Usage

1. **Configure MCP Servers** (New!)
   - Click "Configure Servers" in the MCP Servers section of the sidebar
   - Option 1: Use the form to add servers manually
   - Option 2: Import a Cursor-style JSON configuration file
   - Option 3: Use JSON editor mode to paste configuration directly
   - Example configuration available in `mcp-config-example.json`

2. **Connect to MCP Servers**
   - Start your MCP server processes externally (e.g., run the MQTT or OPC UA servers)
   - In the sidebar, click "Connect" next to each configured server
   - View available tools by expanding the server entry
   - Connected servers will show a green indicator

3. **Choose a Chat Backend**
   - In the top bar of the chat panel, select:
     - `Cloud LLM (ChatGPT / Gemini / Claude)` or  
     - `Local Ollama`

4. **Configure Cloud LLMs**
   - Select a provider (OpenAI, Gemini, Anthropic)
   - Pick a model from the dropdown
   - Provide an API key either:
     - via `.env` file (`VITE_OPENAI_API_KEY`, `VITE_GEMINI_API_KEY`, `VITE_ANTHROPIC_API_KEY`), or  
     - directly in the UI when prompted

5. **Configure Ollama**
   - Ensure Ollama is running locally (default: `http://localhost:11434`)
   - Select or refresh the model list in the header

6. **Start Chatting**
   - Type your message in the input box
   - Press `Enter` to send, `Shift+Enter` for a new line
   - Click the copy icon on assistant messages to copy responses

7. **Manage Sessions**
   - Sessions are created automatically when you start chatting
   - Use the sidebar to switch between sessions

## Project Structure

```
ui/
├── src/
│   ├── components/        # React components
│   │   ├── Sidebar.tsx    # Left sidebar with sessions and theme toggle
│   │   ├── ChatPanel.tsx  # Right panel for chat interface
│   │   └── ThemeProvider.tsx   # Theme context provider
│   ├── types.ts           # TypeScript type definitions
│   ├── utils/             # Utility functions
│   │   ├── theme.ts       # Theme management
│   │   ├── storage.ts     # LocalStorage helpers
│   │   └── llm.ts         # Cloud/Ollama LLM helpers
│   ├── App.tsx            # Main application component
│   └── main.tsx           # Entry point
├── index.html
├── package.json
└── vite.config.ts
```

## Future Enhancements

- [ ] Streaming responses
- [ ] Per-session message history persistence
- [ ] Command/Prompt templates
- [ ] Multi-tab support for multiple sessions

## License

ISC
