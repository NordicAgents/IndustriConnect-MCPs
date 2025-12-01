import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  PlusCircle,
  FolderGit2,
  Moon,
  Sun,
  MessageCircle,
  Boxes,
  Pencil,
  Trash2,
} from 'lucide-react';
import { MCPConfig, MCPSession } from '../types';
import { format } from 'date-fns';
import { useTheme } from './ThemeProvider';

interface SidebarProps {
  mcpConfigs: MCPConfig[];
  sessions: MCPSession[];
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string | null) => void;
  onAddMCP: () => void;
  onEditMCP: (config: MCPConfig) => void;
  onToggleMCP: (configId: string) => void;
  onDeleteMCP: (configId: string) => void;
}

export default function Sidebar({
  mcpConfigs,
  sessions,
  selectedSessionId,
  onSelectSession,
  onAddMCP,
  onEditMCP,
  onToggleMCP,
  onDeleteMCP,
}: SidebarProps) {
  const [sessionsExpanded, setSessionsExpanded] = useState(true);
  const [mcpExpanded, setMcpExpanded] = useState(true);
  const { theme, toggleTheme } = useTheme();
  const activeConfigs = mcpConfigs.filter(c => c.connected);

  return (
    <div className="w-72 border-r border-border bg-background flex flex-col h-screen">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight truncate">
              MCP Manager
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
          <span className="text-xs text-muted-foreground font-medium">IndustriConnect-MCPs</span>
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto">
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
                    onClick={() => onSelectSession(session.id)}
                    className={`w-full px-4 py-2.5 text-left hover:bg-accent/50 transition-all border-l-2 ${selectedSessionId === session.id
                      ? 'bg-accent/50 border-l-primary'
                      : 'border-l-transparent'
                      }`}
                  >
                    <div className="text-sm font-medium mb-1 truncate">{session.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <span className="inline-flex items-center gap-1">
                        {session.mcpIds.length} MCP{session.mcpIds.length !== 1 ? 's' : ''}
                      </span>
                      <span>·</span>
                      <span>{format(session.lastActivity, 'MMM d')}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* MCP Configurations */}
        <div>
          <button
            onClick={() => setMcpExpanded(!mcpExpanded)}
            className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-accent/30 transition-all group"
          >
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-muted-foreground" />
              <div className="flex flex-col items-start">
                <span className="font-medium text-sm">Installed MCP Servers</span>
                <span className="text-[11px] text-muted-foreground">
                  Manage MCP configuration and connection
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                {activeConfigs.length}/{mcpConfigs.length}
              </span>
              {mcpExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform" />
              )}
            </div>
          </button>
          {mcpExpanded && (
            <div className="pb-1">
              {mcpConfigs.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                  No MCPs configured
                </div>
              ) : (
                mcpConfigs.map((config) => (
                  <div
                    key={config.id}
                    className="px-4 py-3 hover:bg-accent/30 transition-all group border-t border-border/60 first:border-t-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-0.5">
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[11px] font-semibold text-muted-foreground">
                            {config.name?.charAt(0)?.toUpperCase() || 'M'}
                          </div>
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium truncate">
                              {config.name}
                            </span>
                            <span className="text-[11px] text-muted-foreground flex-shrink-0">
                              ({config.type})
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {[config.command, ...(config.args || [])].filter(Boolean).join(' ')}
                          </div>
                          {config.tools && config.tools.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {config.tools.slice(0, 6).map((tool) => (
                                <span
                                  key={tool}
                                  className="px-2 py-0.5 rounded-full bg-muted text-[11px] text-muted-foreground"
                                >
                                  {tool}
                                </span>
                              ))}
                              {config.tools.length > 6 && (
                                <span className="px-2 py-0.5 rounded-full bg-muted text-[11px] text-muted-foreground/80">
                                  +{config.tools.length - 6} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onEditMCP(config)}
                            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground transition-colors"
                            title="Edit MCP"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteMCP(config.id)}
                            className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive transition-colors"
                            title="Delete MCP"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button
                          onClick={() => onToggleMCP(config.id)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full border border-border transition-colors ${
                            config.enabled ? 'bg-primary/80' : 'bg-muted'
                          }`}
                          role="switch"
                          aria-checked={config.enabled}
                          title={config.enabled ? 'Disable MCP' : 'Enable MCP'}
                        >
                          <span
                            className={`inline-block h-4 w-4 rounded-full bg-background shadow transition-transform ${
                              config.enabled ? 'translate-x-4' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <span className="text-[11px] text-muted-foreground">
                          {config.connected
                            ? 'Connected'
                            : config.enabled
                              ? 'Connecting...'
                              : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <button
                onClick={onAddMCP}
                className="w-full px-4 py-3 mt-1 flex items-center gap-3 text-left text-xs text-muted-foreground hover:bg-accent/30 border-t border-border/60 transition-all"
              >
                <div className="w-7 h-7 rounded-full border border-dashed border-border flex items-center justify-center text-muted-foreground">
                  <PlusCircle className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">
                    New MCP Server
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Add a custom MCP server configuration
                  </span>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
