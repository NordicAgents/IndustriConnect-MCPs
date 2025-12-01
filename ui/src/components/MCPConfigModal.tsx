import { useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import { MCPConfig, MCPType } from '../types';
import { MCP_TYPES, getDefaultEnvForType, getDefaultToolsForType } from '../data/mcpTemplates';

interface MCPConfigModalProps {
  config: MCPConfig | null;
  onSave: (config: MCPConfig) => void;
  onDelete: (configId: string) => void;
  onClose: () => void;
}

export default function MCPConfigModal({
  config,
  onSave,
  onDelete,
  onClose,
}: MCPConfigModalProps) {
  const [formData, setFormData] = useState<Partial<MCPConfig>>({
    name: '',
    type: 'MODBUS',
    command: '',
    args: [],
    env: {},
    tools: [],
  });

  useEffect(() => {
    if (config) {
      setFormData(config);
    } else {
      const defaultType: MCPType = 'MODBUS';
      setFormData({
        name: '',
        type: defaultType,
        command: MCP_TYPES.find((t) => t.type === defaultType)?.defaultCommand || 'npx',
        args: undefined,
        env: getDefaultEnvForType(defaultType),
        tools: getDefaultToolsForType(defaultType),
      });
    }
  }, [config]);

  const handleTypeChange = (type: MCPType) => {
    const template = MCP_TYPES.find((t) => t.type === type);
    setFormData({
      ...formData,
      type,
      command: template?.defaultCommand || 'npx',
      args:
        type === 'MQTT'
          ? ['mqtt-mcp']
          : type === 'OPC UA'
            ? ['opcua-mcp-npx-server']
            : undefined,
      env: getDefaultEnvForType(type),
      tools: getDefaultToolsForType(type),
    });
  };

  const handleToolsChange = (value: string) => {
    const tools = value
      .split(/[,\s]+/)
      .map((tool) => tool.trim())
      .filter((tool) => tool.length > 0);
    setFormData({
      ...formData,
      tools,
    });
  };

  const handleEnvChange = (key: string, value: string) => {
    setFormData({
      ...formData,
      env: {
        ...formData.env,
        [key]: value,
      },
    });
  };

  const handleAddEnvVar = () => {
    const key = prompt('Environment variable name:');
    if (key) {
      setFormData({
        ...formData,
        env: {
          ...formData.env,
          [key]: '',
        },
      });
    }
  };

  const handleRemoveEnvVar = (key: string) => {
    const newEnv = { ...formData.env };
    delete newEnv[key];
    setFormData({
      ...formData,
      env: newEnv,
    });
  };

  const handleSave = () => {
    if (!formData.name || !formData.type || !formData.command) {
      alert('Please fill in all required fields');
      return;
    }

    const configToSave: MCPConfig = {
      id: config?.id || `${formData.type.toLowerCase().replace(/[\/ ]/g, '-')}-${Date.now()}`,
      name: formData.name,
      type: formData.type as MCPType,
      command: formData.command,
      args: formData.args,
      env: formData.env || {},
      enabled: config?.enabled || false,
      connected: config?.connected || false,
      lastConnected: config?.lastConnected,
      tools: formData.tools || [],
    };

    onSave(configToSave);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-background border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-background">
          <h2 className="text-lg font-semibold tracking-tight">
            {config ? 'Edit MCP Configuration' : 'Add MCP Configuration'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-accent/50 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2">Name *</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-border rounded-md bg-input focus:outline-none focus:ring-2 focus:ring-ring text-sm transition-all"
              placeholder="e.g., MODBUS Production Server"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium mb-2">Protocol Type *</label>
            <select
              value={formData.type || 'MODBUS'}
              onChange={(e) => handleTypeChange(e.target.value as MCPType)}
              className="w-full px-3.5 py-2.5 border border-border rounded-md bg-input focus:outline-none focus:ring-2 focus:ring-ring text-sm transition-all"
            >
              {MCP_TYPES.map((type) => (
                <option key={type.type} value={type.type}>
                  {type.type} - {type.description}
                </option>
              ))}
            </select>
          </div>

          {/* Command */}
          <div>
            <label className="block text-sm font-medium mb-2">Command *</label>
            <input
              type="text"
              value={formData.command || ''}
              onChange={(e) => setFormData({ ...formData, command: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-border rounded-md bg-input focus:outline-none focus:ring-2 focus:ring-ring text-sm transition-all"
              placeholder="e.g., npx, modbus-mcp"
            />
          </div>

          {/* Tools */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Tools / Methods
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            <textarea
              value={(formData.tools || []).join(', ')}
              onChange={(e) => handleToolsChange(e.target.value)}
              className="w-full min-h-[60px] px-3.5 py-2.5 border border-border rounded-md bg-input focus:outline-none focus:ring-2 focus:ring-ring text-sm transition-all resize-y"
              placeholder="e.g., read_opcua_node, write_opcua_node, browse_opcua_node_children"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Separate tool names with commas or spaces. These will be shown as tags in
              the MCP server list, similar to Cursor.
            </p>
          </div>

          {/* Args */}
          {formData.args && formData.args.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Arguments</label>
              <input
                type="text"
                value={formData.args.join(' ')}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    args: e.target.value.split(' ').filter((a) => a.trim()),
                  })
                }
                className="w-full px-3.5 py-2.5 border border-border rounded-md bg-input focus:outline-none focus:ring-2 focus:ring-ring text-sm transition-all"
                placeholder="e.g., mqtt-mcp"
              />
            </div>
          )}

          {/* Environment Variables */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Environment Variables</label>
              <button
                onClick={handleAddEnvVar}
                className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
              >
                + Add Variable
              </button>
            </div>
            <div className="space-y-2">
              {Object.entries(formData.env || {}).map(([key, value]) => (
                <div key={key} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={key}
                    readOnly
                    className="flex-1 px-3.5 py-2.5 border border-border rounded-md bg-muted/50 text-muted-foreground text-sm"
                  />
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => handleEnvChange(key, e.target.value)}
                    className="flex-1 px-3.5 py-2.5 border border-border rounded-md bg-input focus:outline-none focus:ring-2 focus:ring-ring text-sm transition-all"
                    placeholder="Value"
                  />
                  <button
                    onClick={() => handleRemoveEnvVar(key)}
                    className="p-2.5 text-destructive hover:bg-destructive/10 rounded-md transition-all"
                    title="Remove variable"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-background">
          {config && (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to delete this MCP configuration?')) {
                  onDelete(config.id);
                  onClose();
                }
              }}
              className="px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-md transition-all flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium border border-border rounded-md hover:bg-accent/30 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-all flex items-center gap-2 shadow-sm"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
