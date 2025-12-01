# Quick Start Guide

## Installation

```bash
cd ui
npm install
```

## Running the Application

```bash
npm run dev
```

The application will automatically open in your browser at `http://localhost:3000`.

## First Steps

1. **Choose a Chat Backend**
   - In the chat header, pick:
     - `Cloud LLM (ChatGPT / Gemini / Claude)`, or
     - `Local Ollama`

2. **Configure Cloud LLMs**
   - Select a provider (OpenAI, Gemini, Anthropic)
   - Pick a model from the dropdown
   - Provide an API key either via `.env` (`VITE_OPENAI_API_KEY`, `VITE_GEMINI_API_KEY`, `VITE_ANTHROPIC_API_KEY`) or directly in the UI

3. **Configure Ollama**
   - Ensure Ollama is running locally (default: `http://localhost:11434`)
   - Use the URL field and model dropdown to select a model

4. **Start Chatting**
   - Type a message in the input box
   - Press `Enter` to send, `Shift+Enter` for a new line
   - Copy responses using the copy button on assistant messages

5. **Manage Sessions**
   - Sessions are created automatically when you start chatting
   - View all sessions in the sidebar under "Sessions"
   - Click a session to switch to it

6. **Toggle Dark/Light Mode**
   - Click the moon/sun icon in the top-right of the sidebar
   - The theme preference is saved automatically

## Features Overview

- ✅ Chat with cloud LLMs (OpenAI / Gemini / Claude)
- ✅ Chat with local LLMs via Ollama
- ✅ Session management
- ✅ Dark/light mode
- ✅ Persistent storage (localStorage)

## Troubleshooting

**Application won't start:**
- Ensure Node.js 18+ is installed: `node --version`
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`

**Theme not working:**
- Clear browser cache and reload
- Check browser console for errors

## Next Steps

- Add streaming responses
- Implement command/prompt templates
- Add export/import functionality for sessions
