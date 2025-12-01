import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FolderGit2,
  Moon,
  Sun,
  MessageCircle,
  Server,
  Settings,
} from 'lucide-react';
import { ChatSession } from '../types';
import { MCPServer } from '../types/mcp-types';
import { format } from 'date-fns';
import { useTheme } from './ThemeProvider';
import MCPServerList from './MCPServerList';

interface SidebarProps {
  sessions: ChatSession[];
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string | null) => void;
  mcpServers: MCPServer[];
  onMCPConnect: (serverId: string) => void;
  onMCPDisconnect: (serverId: string) => void;
  onMCPConfigOpen: () => void;
}

export default function Sidebar({
  sessions,
  selectedSessionId,
  onSelectSession,
  mcpServers,
  onMCPConnect,
  onMCPDisconnect,
  onMCPConfigOpen,
}: SidebarProps) {
  const [sessionsExpanded, setSessionsExpanded] = useState(true);
  const [mcpExpanded, setMcpExpanded] = useState(true);
  const { theme, toggleTheme } = useTheme();

  const connectedCount = mcpServers.filter(s => s.status === 'connected').length;

  return (
    <div className="w-72 border-r border-border bg-background flex flex-col h-screen">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight truncate">
              LLM Chat
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              IndustriConnect
            </p>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md hover:bg-accent/50 transition-all"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Repository/Branch Info */}
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between text-sm bg-muted/30">
        <div className="flex items-center gap-2">
          <FolderGit2 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">
            IndustriConnect
          </span>
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto">
        {/* MCP Servers Section */}
        <div className="border-b border-border">
          <button
            onClick={() => setMcpExpanded(!mcpExpanded)}
            className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-accent/30 transition-all group"
          >
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">MCP Servers</span>
              {connectedCount > 0 && (
                <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                  {connectedCount}
                </span>
              )}
            </div>
            {mcpExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform" />
            )}
          </button>
          {mcpExpanded && (
            <div>
              <MCPServerList
                servers={mcpServers}
                onConnect={onMCPConnect}
                onDisconnect={onMCPDisconnect}
              />
              <div className="px-4 py-2 border-t border-border">
                <button
                  onClick={onMCPConfigOpen}
                  className="w-full px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded-md transition-colors flex items-center justify-center gap-2"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Configure Servers
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sessions Section */}
        <div className="border-b border-border">
          <button
            onClick={() => setSessionsExpanded(!sessionsExpanded)}
            className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-accent/30 transition-all group"
          >
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">Sessions</span>
            </div>
            {sessionsExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform" />
            )}
          </button>
          {sessionsExpanded && (
            <div className="pb-1">
              {sessions.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                  No sessions yet
                </div>
              ) : (
                sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() =>
                      onSelectSession(
                        selectedSessionId === session.id ? null : session.id,
                      )
                    }
                    className={`w-full px-4 py-2.5 text-left hover:bg-accent/50 transition-all border-l-2 ${selectedSessionId === session.id
                      ? 'bg-accent/50 border-l-primary'
                      : 'border-l-transparent'
                      }`}
                  >
                    <div className="text-sm font-medium mb-1 truncate">{session.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <span>{format(session.lastActivity, 'MMM d')}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Reserved for future configuration sections */}
      </div>
    </div>
  );
}
