import { MCPType, MCPConfig } from '../types';

export const MCP_TYPES: {
  type: MCPType;
  description: string;
  defaultCommand: string;
}[] = [
  { type: 'BACnet', description: 'BACnet Protocol', defaultCommand: 'bacnet-mcp' },
  { type: 'DNP3', description: 'DNP3 Protocol', defaultCommand: 'dnp3-mcp' },
  { type: 'EtherCAT', description: 'EtherCAT Protocol', defaultCommand: 'ethercat-mcp' },
  { type: 'EtherNet/IP', description: 'EtherNet/IP Protocol', defaultCommand: 'ethernetip-mcp' },
  { type: 'MODBUS', description: 'MODBUS Protocol', defaultCommand: 'modbus-mcp' },
  { type: 'MQTT', description: 'MQTT + Sparkplug B', defaultCommand: 'npx' },
  // For OPC UA we default to the NPX-based server (opcua-mcp-npx-server)
  { type: 'OPC UA', description: 'OPC UA Protocol', defaultCommand: 'npx' },
  { type: 'PROFIBUS', description: 'PROFIBUS Protocol', defaultCommand: 'profibus-mcp' },
  { type: 'PROFINET', description: 'PROFINET Protocol', defaultCommand: 'profinet-mcp' },
  { type: 'S7comm', description: 'S7comm Protocol', defaultCommand: 's7comm-mcp' },
];

const DEFAULT_ENV_BY_TYPE: Record<MCPType, Record<string, string>> = {
  BACnet: {
    BACNET_INTERFACE: '0.0.0.0',
    BACNET_PORT: '47808',
    BACNET_DEVICE_INSTANCE: '1234',
  },
  DNP3: {
    DNP3_CONNECTION_TYPE: 'tcp',
    DNP3_HOST: '127.0.0.1',
    DNP3_PORT: '20000',
  },
  EtherCAT: {
    ETHERCAT_INTERFACE: 'eth0',
  },
  'EtherNet/IP': {
    ENIP_HOST: '127.0.0.1',
    ENIP_SLOT: '0',
    ENIP_PORT: '44818',
  },
  MODBUS: {
    MODBUS_TYPE: 'tcp',
    MODBUS_HOST: '127.0.0.1',
    MODBUS_PORT: '502',
    MODBUS_DEFAULT_SLAVE_ID: '1',
  },
  MQTT: {
    MQTT_BROKER_URL: 'mqtt://127.0.0.1:1883',
    MQTT_CLIENT_ID: 'mqtt-mcp-client',
    MQTT_KEEPALIVE: '60',
    SPARKPLUG_GROUP_ID: 'factory',
    SPARKPLUG_EDGE_NODE_ID: 'edge-node-1',
  },
  'OPC UA': {
    OPCUA_SERVER_URL: 'opc.tcp://localhost:4840',
  },
  PROFIBUS: {
    PROFIBUS_INTERFACE: 'eth0',
  },
  PROFINET: {
    PROFINET_INTERFACE: 'eth0',
    PROFINET_CONTROLLER_IP: '192.168.1.1',
  },
  S7comm: {
    S7_HOST: '127.0.0.1',
    S7_RACK: '0',
    S7_SLOT: '2',
    S7_PORT: '102',
  },
};

const DEFAULT_TOOLS_BY_TYPE: Record<MCPType, string[]> = {
  BACnet: [],
  DNP3: [],
  EtherCAT: [],
  'EtherNet/IP': [],
  MODBUS: [],
  MQTT: [],
  'OPC UA': [
    'read_opcua_node',
    'write_opcua_node',
    'browse_opcua_node_children',
    'call_opcua_method',
    'read_multiple_opcua_nodes',
    'write_multiple_opcua_nodes',
    'get_all_variables',
  ],
  PROFIBUS: [],
  PROFINET: [],
  S7comm: [],
};

export const getDefaultEnvForType = (type: MCPType): Record<string, string> => {
  return DEFAULT_ENV_BY_TYPE[type] || {};
};

export const getDefaultToolsForType = (type: MCPType): string[] => {
  return DEFAULT_TOOLS_BY_TYPE[type] || [];
};

export const createDefaultMCPConfig = (type: MCPType, name: string): MCPConfig => {
  const template = MCP_TYPES.find((t) => t.type === type);
  return {
    id: `${type.toLowerCase().replace(/[\/ ]/g, '-')}-${Date.now()}`,
    name,
    type,
    command: template?.defaultCommand || 'npx',
    args:
      type === 'MQTT'
        ? ['mqtt-mcp']
        : type === 'OPC UA'
          ? ['opcua-mcp-npx-server']
          : undefined,
    env: getDefaultEnvForType(type),
    enabled: false,
    connected: false,
    tools: getDefaultToolsForType(type),
  };
};
