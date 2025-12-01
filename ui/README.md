# LLM Chat UI

A modern, intuitive chat interface for working with local and third‑party language models in the IndustriConnect ecosystem. Built with React, TypeScript, and Tailwind CSS.

## Features

- 🎨 **Beautiful UI** – Modern interface inspired by Claude Code with clean design  
- 🌓 **Dark/Light Mode** – Seamless theme switching with system preference detection  
- ☁️ **Cloud LLM Support** – Talk to OpenAI (ChatGPT), Google Gemini, and Anthropic Claude  
- 💻 **Local LLM Support (Ollama)** – Chat with local models running via Ollama  
- 💬 **Interactive Chat** – Streaming‑style conversational UI with copy‑to‑clipboard  
- 📝 **Session Management** – Simple session list to keep track of conversations  
- 💾 **Local Storage** – Remembers chat backend and LLM configuration between visits

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
cd ui
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

1. **Choose a Chat Backend**
   - In the top bar of the chat panel, select:
     - `Cloud LLM (ChatGPT / Gemini / Claude)` or  
     - `Local Ollama`

2. **Configure Cloud LLMs**
   - Select a provider (OpenAI, Gemini, Anthropic)
   - Pick a model from the dropdown
   - Provide an API key either:
     - via `.env` file (`VITE_OPENAI_API_KEY`, `VITE_GEMINI_API_KEY`, `VITE_ANTHROPIC_API_KEY`), or  
     - directly in the UI when prompted

3. **Configure Ollama**
   - Ensure Ollama is running locally (default: `http://localhost:11434`)
   - Select or refresh the model list in the header

4. **Start Chatting**
   - Type your message in the input box
   - Press `Enter` to send, `Shift+Enter` for a new line
   - Click the copy icon on assistant messages to copy responses

5. **Manage Sessions**
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
