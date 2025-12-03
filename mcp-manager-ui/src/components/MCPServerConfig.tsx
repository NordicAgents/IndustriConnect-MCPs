import { useState } from 'react';
import { Plus, X, Upload, Download } from 'lucide-react';
import { MCPServersConfig, MCPServerConfig } from '../types/mcp-types';
import { importCursorConfig, exportCursorConfig } from '../utils/mcp-storage';

interface MCPServerConfigProps {
    config: MCPServersConfig;
    onConfigChange: (config: MCPServersConfig) => void;
    onClose: () => void;
}

export default function MCPServerConfigPanel({
    config,
    onConfigChange,
    onClose,
}: MCPServerConfigProps) {
    const [editMode, setEditMode] = useState<'form' | 'json'>('form');
    const [selectedServer, setSelectedServer] = useState<string | null>(null);
    const [jsonInput, setJsonInput] = useState(exportCursorConfig(config));
    const [jsonError, setJsonError] = useState<string | null>(null);

    // Form state for adding/editing servers
    const [formData, setFormData] = useState<{
        name: string;
        command: string;
        args: string;
        env: string;
    }>({
        name: '',
        command: '',
        args: '',
        env: '',
    });

    const handleAddServer = () => {
        if (!formData.name || !formData.command) {
            alert('Server name and command are required');
            return;
        }

        const newConfig = { ...config };
        const serverConfig: MCPServerConfig = {
            command: formData.command,
            args: formData.args.split('\n').filter(a => a.trim()),
            env: formData.env ? JSON.parse(formData.env) : undefined,
        };

        newConfig.mcpServers[formData.name] = serverConfig;
        onConfigChange(newConfig);

        // Reset form
        setFormData({ name: '', command: '', args: '', env: '' });
    };

    const handleDeleteServer = (serverName: string) => {
        const newConfig = { ...config };
        delete newConfig.mcpServers[serverName];
        onConfigChange(newConfig);
        if (selectedServer === serverName) {
            setSelectedServer(null);
        }
    };

    const handleImportJSON = () => {
        const imported = importCursorConfig(jsonInput);
        if (imported) {
            onConfigChange(imported);
            setJsonError(null);
            setEditMode('form');
        } else {
            setJsonError('Invalid JSON format');
        }
    };

    const handleExportJSON = () => {
        const json = exportCursorConfig(config);
        navigator.clipboard.writeText(json);
        alert('Configuration copied to clipboard!');
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target?.result as string;
                const imported = importCursorConfig(content);
                if (imported) {
                    onConfigChange(imported);
                    setJsonError(null);
                } else {
                    setJsonError('Invalid configuration file');
                }
            };
            reader.readAsText(file);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background border border-border rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-border flex items-center justify-between">
                    <h2 className="text-lg font-semibold">MCP Server Configuration</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-accent/50 rounded-md transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Mode Switcher */}
                <div className="p-4 border-b border-border flex gap-2">
                    <button
                        onClick={() => setEditMode('form')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${editMode === 'form'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted hover:bg-muted/80'
                            }`}
                    >
                        Form Editor
                    </button>
                    <button
                        onClick={() => setEditMode('json')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${editMode === 'json'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted hover:bg-muted/80'
                            }`}
                    >
                        JSON Editor
                    </button>
                    <div className="flex-1" />
                    <button
                        onClick={handleExportJSON}
                        className="px-4 py-2 rounded-md text-sm font-medium bg-muted hover:bg-muted/80 flex items-center gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                    <label className="px-4 py-2 rounded-md text-sm font-medium bg-muted hover:bg-muted/80 flex items-center gap-2 cursor-pointer">
                        <Upload className="w-4 h-4" />
                        Import File
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleFileImport}
                            className="hidden"
                        />
                    </label>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {editMode === 'form' ? (
                        <div className="space-y-6">
                            {/* Existing Servers */}
                            <div>
                                <h3 className="text-sm font-semibold mb-3">Configured Servers</h3>
                                {Object.keys(config.mcpServers).length === 0 ? (
                                    <div className="text-sm text-muted-foreground text-center py-8">
                                        No servers configured yet. Add one below.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {Object.entries(config.mcpServers).map(([name, serverConfig]) => (
                                            <div
                                                key={name}
                                                className="p-3 border border-border rounded-md bg-muted/30"
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium text-sm mb-1">{name}</div>
                                                        <div className="text-xs text-muted-foreground font-mono truncate">
                                                            {serverConfig.command} {serverConfig.args.join(' ')}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDeleteServer(name)}
                                                        className="p-1 hover:bg-destructive/20 hover:text-destructive rounded-md transition-colors ml-2"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Add New Server Form */}
                            <div className="border-t border-border pt-6">
                                <h3 className="text-sm font-semibold mb-3">Add New Server</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Server Name <span className="text-destructive">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="e.g., MQTT MCP (Python)"
                                            className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Command <span className="text-destructive">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.command}
                                            onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                                            placeholder="e.g., uv"
                                            className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm font-mono"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Arguments (one per line)
                                        </label>
                                        <textarea
                                            value={formData.args}
                                            onChange={(e) => setFormData({ ...formData, args: e.target.value })}
                                            placeholder="--directory&#10;/path/to/project&#10;run&#10;mqtt-mcp"
                                            rows={4}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm font-mono"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Environment Variables (JSON object)
                                        </label>
                                        <textarea
                                            value={formData.env}
                                            onChange={(e) => setFormData({ ...formData, env: e.target.value })}
                                            placeholder='{"MQTT_BROKER_URL": "mqtt://127.0.0.1:1883"}'
                                            rows={3}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm font-mono"
                                        />
                                    </div>

                                    <button
                                        onClick={handleAddServer}
                                        className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 flex items-center gap-2"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Add Server
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    JSON Configuration (Cursor Format)
                                </label>
                                <textarea
                                    value={jsonInput}
                                    onChange={(e) => {
                                        setJsonInput(e.target.value);
                                        setJsonError(null);
                                    }}
                                    rows={20}
                                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm font-mono"
                                />
                                {jsonError && (
                                    <div className="mt-2 text-sm text-destructive">{jsonError}</div>
                                )}
                            </div>
                            <button
                                onClick={handleImportJSON}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
                            >
                                Apply JSON Configuration
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
