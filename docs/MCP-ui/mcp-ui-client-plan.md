## MCP Manager UI – Node/TypeScript MCP Client Plan

This document outlines how to build a Node/TypeScript‑based MCP client that:

- Reads an `mcp.json`–style configuration.
- Starts the `mcp-manager-ui` MCP server (and other servers later).
- Speaks MCP over stdio (JSON‑RPC).
- Connects to an LLM (local or hosted) and routes tool calls to MCP.

> Root repo: `/Users/mx/Documents/Work/industriAgents/IndustriConnect-MCPs`  
> UI server repo: `mcp-manager-ui`  
> This client will live alongside the existing projects (e.g., under `mcp-manager-ui` or a new `mcp-client` folder).

---

### 1. Goals and Non‑Goals

- **Goals**
  - Provide a **Cursor‑like MCP experience** without depending on Cursor.
  - Support **multiple MCP servers** (Node/TS, Python) via a single client.
  - Use a simple **`mcp.json` configuration** to define servers and runtime options.
  - Enable **chat with an LLM** where the LLM can:
    - See available MCP tools and resources.
    - Call tools through the client.
    - Receive tool results and continue the conversation.

- **Non‑Goals (for v1)**
  - No multi‑tenant auth or RBAC.
  - No web UI yet (terminal/CLI only).
  - No persistence of conversations beyond the current process.

---

### 2. High‑Level Architecture

- **MCP Client (Node/TS app)**
  - Reads a configuration file (`mcp.json` or `mcp-client.config.json`).
  - Spawns **MCP servers** as child processes.
  - Implements MCP **client side** of JSON‑RPC over stdio.
  - Maintains per‑server connection state and tool registry.
  - Hosts a **chat loop** with the LLM that:
    - Sends user messages to LLM.
    - Detects/handles LLM tool calls (using model’s tool‑calling API).
    - Invokes corresponding MCP tools and returns results to LLM.

- **MCP Servers (existing)**
  - `mcp-manager-ui` (Node/TS MCP server).
  - Future: OPC UA, other protocol servers (Python, TS) in `OPCUA-Project`, etc.

- **LLM Backend**
  - Initial target: **OpenAI‑compatible** chat API (e.g., `gpt-4.1`, `gpt-4o`, or local vLLM with OpenAI‑compatible API).
  - The client holds API keys/config via `.env`.

---

### 3. Project Layout Proposal

Choose either a **dedicated client project** or embed inside `mcp-manager-ui`. Recommended: dedicated.

**Option A – Dedicated client project (recommended)**

- Add a new folder:  
  - `mcp-ui-client/`
- Structure:
  - `mcp-ui-client/package.json`
  - `mcp-ui-client/tsconfig.json`
  - `mcp-ui-client/src/index.ts` (CLI entrypoint)
  - `mcp-ui-client/src/config.ts` (config loading and validation)
  - `mcp-ui-client/src/mcp/connection.ts` (MCP stdio client implementation)
  - `mcp-ui-client/src/mcp/serverRegistry.ts` (server lifecycle management)
  - `mcp-ui-client/src/chat/llmClient.ts` (LLM API wrapper)
  - `mcp-ui-client/src/chat/session.ts` (chat loop and tool routing)
  - `mcp-ui-client/.env` (LLM config, etc.)
  - `mcp-ui-client/mcp.json` (local MCP server config, or reuse root‑level config)

**Option B – Inside `mcp-manager-ui`**

- Add a `cli/` or `client/` directory under `mcp-manager-ui` with similar structure.
- Use the same package manager as `mcp-manager-ui` (pnpm/yarn/npm).

For now, this plan assumes **Option A**.

---

### 4. Configuration Design (`mcp.json`)

Reuse the Cursor‑style `mcp.json` structure to keep mental model consistent, but owned by the client.

**File:** `mcp-ui-client/mcp.json`

**Structure (example):**

```json
{
  "mcpServers": {
    "mcp-manager-ui": {
      "command": "pnpm",
      "args": ["mcp-server"],
      "cwd": "../mcp-manager-ui",
      "env": {
        "NODE_ENV": "development"
      }
    },
    "opcua-server": {
      "command": "python",
      "args": ["-m", "opcuaproject.mcp_server"],
      "cwd": "../OPCUA-Project",
      "env": {}
    }
  }
}
```

**Client‑side config (`mcp-ui-client/.env`):**

- `LLM_PROVIDER=openai` (or `openai-compatible`)
- `OPENAI_API_KEY=...`
- `OPENAI_BASE_URL=https://api.openai.com/v1` (or custom endpoint)
- `OPENAI_MODEL=gpt-4.1` (or similar)

**Config tasks**

1. Implement `Config` types in `config.ts`:
   - `McpServerConfig`, `ClientConfig`.
2. Load `mcp.json` and `.env` (using `dotenv`).
3. Add validation (e.g., `zod` or hand‑rolled checks) with clear error messages:
   - Missing `command`, bad paths, etc.

---

### 5. MCP Client Core (Stdio JSON‑RPC)

Implement a reusable MCP connection module.

**Responsibilities**

- Start a server process via `child_process.spawn` using:
  - `command`, `args`, `cwd`, `env`.
- Wire `stdin`/`stdout` as a JSON‑RPC channel:
  - Frame messages using line‑delimited JSON or JSON‑RPC standard.
  - Maintain an in‑memory `pendingRequests` map keyed by `id`.
- Implement basic MCP client methods:
  - `initialize()`
  - `listTools()`
  - `callTool(toolName, args)`
  - `listResources()` (if needed)
  - `readResource(resourceId)` (if needed)
- Handle server lifecycle:
  - Start on demand (when first used).
  - Detect exit/crash; surface errors to user.
  - Clean shutdown on SIGINT/SIGTERM.

**Implementation steps**

1. Create `src/mcp/connection.ts`:
   - Define `McpConnection` class with:
     - `constructor(config: McpServerConfig)`
     - `start(): Promise<void>`
     - `request<T>(method: string, params?: any): Promise<T>`
     - `notify(method: string, params?: any): void`
     - `listTools`, `callTool`, etc., wrapping `request`.
   - Implement JSON‑RPC message handling:
     - Parse stdout line‑by‑line or using a framing protocol supported by the server.
     - Resolve/reject pending promises based on responses.
2. Create `src/mcp/serverRegistry.ts`:
   - Holds a map from `serverName` → `McpConnection`.
   - Lazy‑starts connections on first use.
   - Exposes methods:
     - `getAllTools(): Promise<RegisteredTool[]>` (with server name included).
     - `callTool(serverName, toolName, args): Promise<any>`.

---

### 6. LLM Integration

Use a thin wrapper around the OpenAI (or compatible) chat API.

**Responsibilities**

- Maintain conversation history: user messages, assistant messages, tool calls/results.
- Expose:
  - `sendUserMessage(text: string): Promise<LLMResponse>`
  - `sendToolResult(toolCallId, result): Promise<LLMResponse>` (if using streaming tool calls).
- Support **tool calling**:
  - Register a list of tools derived from MCP servers:
    - Each MCP tool becomes an LLM tool definition (JSON schema for params).
    - Include `serverName` as part of the tool name or metadata.
  - When LLM requests a tool, map back to:
    - `serverName`, `toolName`, and tool params.

**Implementation steps**

1. Create `src/chat/llmClient.ts`:
   - Wrap `@ai-sdk/openai` or `openai` npm package, pointing at configured base URL and model.
   - Accept tool definitions:
     - `registerTools(tools: LlmToolDefinition[])`.
2. Define `LlmToolDefinition` shape:
   - `name`, `description`, `parameters` (JSON schema), `serverName` metadata.
3. Convert MCP `listTools` responses into LLM tools:
   - A helper to map MCP tool schema → OpenAI tool schema.

---

### 7. Chat Session and Tool Routing

Implement a CLI chat experience that:

- Reads user input from stdin (`readline`).
- Sends each message to the LLM with available tools.
- When the LLM requests a tool:
  - Identify the corresponding MCP server and tool.
  - Call the MCP tool via `serverRegistry`.
  - Feed the result back to the LLM as a tool result message.
- Prints assistant responses to the terminal.

**Implementation steps**

1. Create `src/chat/session.ts`:
   - `startInteractiveSession()`:
     - Initialize config and MCP connections.
     - Aggregate tools from all servers via `serverRegistry.getAllTools()`.
     - Register those tools with `llmClient`.
     - Enter a loop:
       - Prompt user for input (`> `).
       - Call `llmClient.sendUserMessage`.
       - If the response includes tool calls, execute them via MCP and loop until the LLM returns a normal message.
2. Provide options:
   - `--no-tools` (debugging without MCP).
   - `--server mcp-manager-ui` (only use tools from one server).

---

### 8. CLI Surface and Developer Workflow

**CLI Commands (via `src/index.ts`)**

- `mcp-ui-client chat`
  - Starts interactive chat with all configured servers.
- `mcp-ui-client list-tools`
  - Lists all tools grouped by server.
- `mcp-ui-client call <server> <tool> [jsonArgs]`
  - Calls a specific tool once and prints JSON result.

**Developer workflow**

1. `cd mcp-ui-client`
2. `pnpm install` (or `npm`, `yarn` based on repo choice).
3. Copy `.env.example` → `.env`, set LLM API details.
4. Edit `mcp.json` to point at `mcp-manager-ui` and any other servers.
5. Run:
   - `pnpm dev` → runs `ts-node`/`tsx` on `src/index.ts`.
   - `pnpm build` → compiles to JS.
   - `pnpm start` → runs built JS.

---

### 9. Integration with `mcp-manager-ui`

Specific considerations for the UI MCP server:

- Ensure `mcp-manager-ui` exposes a **clean set of tools**:
  - For example: `listProjects`, `getProjectConfig`, `updateProjectConfig`, etc.
- Verify that `mcp-manager-ui`:
  - Implements MCP initialization and `list_tools` endpoints correctly.
  - Returns JSON Schemas for tool parameters that can be mapped directly.
- Add a **quickstart** snippet to `mcp-manager-ui/README.md` once the client exists:
  - “To chat with the UI server via the Node MCP client, see `docs/MCP-ui/mcp-ui-client-plan.md` and `mcp-ui-client/README.md`.”

---

### 10. Milestones / Implementation Order

1. **Scaffold client project**
   - Create `mcp-ui-client` folder, TS config, `package.json`, `.env.example`, `mcp.json`.
2. **Implement config loading**
   - Read `mcp.json`, `.env`, validate.
3. **Implement MCP connection + registry**
   - Start a single server (`mcp-manager-ui`) and successfully call `listTools`.
4. **Implement LLM wrapper**
   - Hard‑code a single tool for a test model call.
5. **Wire MCP tools into LLM tools**
   - Map `listTools` → tool definitions; handle a simple tool call.
6. **Build interactive `chat` command**
   - Enable full loop: user → LLM → MCP tool → LLM → user.
7. **Add multi‑server support**
   - Register multiple servers (`OPCUA-Project`, others) and namespace tools.
8. **Polish and docs**
   - Add `README.md` to `mcp-ui-client` explaining usage.
   - Update `docs/MCP-ui` as implementation details sharpen.

---

### 11. Future Enhancements (Post‑v1)

- Web UI (React/Next) on top of this client as a backend.
- Session persistence (store chats and tool call logs).
- Authentication and multi‑user support.
- Metrics/logging for MCP tool usage.
- Hot‑reload of `mcp.json` and `.env` without restarting the client.

