import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { McpServerConfig } from "../config";

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export interface ListToolsResult {
  tools: McpTool[];
}

export interface CallToolParams {
  name: string;
  arguments?: Record<string, unknown>;
}

interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  timeout: NodeJS.Timeout;
}

export class McpConnection extends EventEmitter {
  private child?: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<number, PendingRequest<any>>();
  private buffer = "";
  private nextId = 1;
  private started = false;

  constructor(
    private readonly name: string,
    private readonly config: McpServerConfig,
    private readonly requestTimeoutMs: number
  ) {
    super();
  }

  async start(): Promise<void> {
    if (this.started) return;
    if (!this.config.command) {
      throw new Error(
        `Server ${this.name} is configured with a URL or missing command. URL-based servers are not yet supported.`
      );
    }

    const child = spawn(this.config.command, this.config.args ?? [], {
      cwd: this.config.cwd,
      env: { ...process.env, ...this.config.env }
    });

    this.child = child;
    this.started = true;

    child.stdout.on("data", (chunk: Buffer) => this.handleChunk(chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => {
      this.emit("stderr", chunk.toString());
    });
    child.on("exit", (code, signal) => {
      this.emit("exit", { code, signal });
      this.rejectAllPending(
        new Error(`Server ${this.name} exited (code=${code}, signal=${signal ?? "none"})`)
      );
    });

    child.on("error", (err) => {
      this.emit(
        "stderr",
        `Failed to start ${this.name}: ${(err as Error).message || String(err)}`
      );
    });

    // Best-effort initialize; some servers may not require it.
    try {
      await this.request("initialize", { capabilities: {} });
    } catch (err) {
      this.emit(
        "warn",
        `initialize failed for ${this.name}: ${(err as Error).message ?? String(err)}`
      );
    }
  }

  stop(): void {
    if (this.child) {
      this.child.kill();
      this.child = undefined;
    }
    this.started = false;
    this.rejectAllPending(new Error(`Server ${this.name} was stopped`));
  }

  async listTools(): Promise<McpTool[]> {
    // MCP spec: tools/list returns { tools: [...] }
    const response = await this.request<ListToolsResult>("tools/list");
    return response?.tools ?? [];
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const params: CallToolParams = { name: toolName, arguments: args ?? {} };
    // MCP spec: tools/call with { name, arguments }
    return this.request("tools/call", params);
  }

  private handleChunk(chunk: string): void {
    this.buffer += chunk;
    let newlineIndex = this.buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const raw = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (raw) {
        this.handleMessage(raw);
      }
      newlineIndex = this.buffer.indexOf("\n");
    }
  }

  private handleMessage(raw: string): void {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch (err) {
      this.emit("warn", `Failed to parse MCP message from ${this.name}: ${raw}`);
      return;
    }

    if (msg && typeof msg.id !== "undefined") {
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      if (msg.error) {
        pending.reject(new Error(msg.error.message || "Unknown MCP error"));
      } else {
        pending.resolve(msg.result);
      }
      clearTimeout(pending.timeout);
      this.pending.delete(msg.id);
    } else if (msg?.method) {
      this.emit("notification", msg);
    }
  }

  private async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    await this.ensureStarted();
    const id = this.nextId++;
    const payload = { jsonrpc: "2.0", id, method, params };

    if (!this.child || !this.child.stdin.writable || this.child.killed) {
      throw new Error(
        `Cannot write MCP request for ${this.name}; process not running or stdin closed`
      );
    }

    const writeOk = this.child.stdin.write(`${JSON.stringify(payload)}\n`);
    if (writeOk === false) {
      throw new Error(`Failed to write MCP request for ${this.name}; stdin backpressure/closed`);
    }

    return await new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request timed out after ${this.requestTimeoutMs}ms`));
      }, this.requestTimeoutMs);

      this.pending.set(id, { resolve, reject, timeout });
    });
  }

  private async ensureStarted(): Promise<void> {
    if (!this.started) {
      await this.start();
    }
  }

  private rejectAllPending(err: Error): void {
    for (const [id, pending] of this.pending.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(err);
      this.pending.delete(id);
    }
  }
}
