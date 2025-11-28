# Beckhoff ADS Protocol MCP Server - Implementation Plan
## TwinCAT Automation Device Specification

## Project Overview

This plan outlines the development of a **Model Context Protocol (MCP) server for Beckhoff ADS** (Automation Device Specification) - Beckhoff's communication protocol for TwinCAT systems and PLCs. The implementation will follow the proven architecture from the MODBUS-Project, enabling AI agents and MCP-compatible applications to communicate with Beckhoff TwinCAT controllers for industrial automation and motion control.

## Project Goals

- Create a production-ready MCP server for Beckhoff ADS Protocol
- Support both Python and NPM/TypeScript implementations
- Provide comprehensive tooling for symbol operations, notifications, and device control
- Include a mock TwinCAT system for testing and development
- Maintain consistency with the MODBUS-Project architecture and patterns
- Enable seamless AI agent integration with Beckhoff TwinCAT systems
- Support ADS over TCP/IP (AMS protocol)

## Repository Structure

```
ADS-Project/
├── .gitignore                    # Combined ignore patterns (Python, Node, IDE)
├── README.md                     # Main project documentation
├── ads-python/                   # Python MCP server implementation
│   ├── .gitignore
│   ├── .python-version
│   ├── README.md
│   ├── pyproject.toml           # uv/pip configuration
│   ├── uv.lock
│   └── src/
│       └── ads_mcp/
│           ├── __init__.py
│           ├── cli.py           # Entry point (ads-mcp command)
│           ├── server.py        # MCP server implementation
│           ├── tools.py         # ADS Protocol tool definitions
│           └── ads_client.py    # ADS Protocol client wrapper
├── ads-npm/                     # NPM/TypeScript MCP server
│   ├── .gitignore
│   ├── README.md
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── mcp-config-example.json
│   └── src/
│       └── index.ts             # Main MCP server + tools
└── ads-mock-plc/                # Mock TwinCAT system for testing
    ├── .gitignore
    ├── README.md
    ├── pyproject.toml
    └── ads_mock_plc.py          # Simulated TwinCAT PLC
```

## Technology Stack

### Python Implementation (ads-python)
- **Python**: 3.10+
- **Package Manager**: uv (modern, fast dependency manager)
- **MCP SDK**: `mcp[cli]>=1.6.0`
- **ADS Protocol**: `pyads>=3.4.0`
- **Environment**: `python-dotenv>=1.1.0`
- **Build System**: hatchling

### NPM Implementation (ads-npm)
- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.6+
- **MCP SDK**: `@modelcontextprotocol/sdk@^1.2.0`
- **ADS Protocol**: `ads-client@^1.15.0`
- **Environment**: `dotenv@^16.4.5`
- **Build**: TypeScript compiler

### Mock PLC (ads-mock-plc)
- **Python**: 3.10+
- **Framework**: Custom ADS/AMS server implementation using pyads
- **Package Manager**: uv

## Core Features & Tools

### 1. Symbol Operations
- **read_symbol**: Read variable by symbol name
  - Parameters: symbol_name
  - Automatic type detection
- **write_symbol**: Write variable by symbol name
  - Parameters: symbol_name, value
- **read_symbols**: Read multiple symbols
- **write_symbols**: Write multiple symbols

### 2. Handle Operations
- **get_handle**: Get handle for symbol
- **read_by_handle**: Read using handle
- **write_by_handle**: Write using handle
- **release_handle**: Release handle
- **read_write_handle**: Combined read/write operation

### 3. Notification/COV Operations
- **add_notification**: Add notification for variable changes
  - Parameters: symbol_name, cycle_time, callback
- **delete_notification**: Remove notification
- **get_notifications**: List active notifications

### 4. Index Group/Offset Operations
- **read_by_index**: Read by index group and offset
- **write_by_index**: Write by index group and offset
- **read_device_info**: Read device information
- **read_state**: Read PLC state

### 5. Device State Control
- **read_state**: Read device state and ADS state
- **write_control**: Write control command to device
- **read_device_state**: Get device state info
- **start_plc**: Start PLC runtime
- **stop_plc**: Stop PLC runtime
- **reset_plc**: Reset PLC

### 6. Upload/Download Operations
- **upload_info**: Upload symbol information
- **download_data**: Download data to PLC
- **read_list**: Read list of available symbols

### 7. Symbol Map System
- **list_symbols**: List all configured symbols from map
- **read_symbol_by_alias**: Read by alias name
- **write_symbol_by_alias**: Write by alias name
- Symbol configuration file format (JSON):
```json
{
  "ConveyorSpeed": {
    "symbol": "MAIN.ConveyorSpeed",
    "data_type": "INT",
    "description": "Conveyor belt speed setpoint",
    "unit": "RPM"
  },
  "MotorRunning": {
    "symbol": "MAIN.Motor.bRun",
    "data_type": "BOOL",
    "description": "Motor running status"
  },
  "Temperature": {
    "symbol": "MAIN.Sensors.rTemp",
    "data_type": "REAL",
    "description": "Process temperature",
    "unit": "celsius"
  },
  "AxisPosition": {
    "symbol": "Axis[1].NcToPlc.ActPos",
    "data_type": "LREAL",
    "description": "Servo axis position",
    "unit": "mm"
  }
}
```

### 8. Data Type Conversions
- **read_bool**: Read as BOOL
- **read_int**: Read as INT/DINT/LINT
- **read_uint**: Read as UINT/UDINT/ULINT
- **read_real**: Read as REAL/LREAL
- **read_string**: Read as STRING
- **read_time**: Read as TIME/DATE_AND_TIME
- **read_struct**: Read structured data type

### 9. Route Management
- **add_route**: Add AMS route
- **delete_route**: Delete AMS route
- **get_local_address**: Get local AMS address

### 10. Diagnostics & Health
- **ping**: Connection health check
- **get_timeout**: Get timeout value
- **set_timeout**: Set timeout value
- **read_device_info**: Read device information
- **test_connection**: Test ADS connection

## Environment Variables

```bash
# AMS Net ID and Port
ADS_NET_ID=127.0.0.1.1.1         # Target AMS Net ID (default: 127.0.0.1.1.1)
ADS_PORT=851                     # Target ADS port (default: 851 - PLC runtime 1)

# Local AMS Settings
ADS_LOCAL_NET_ID=                # Local AMS Net ID (auto-detect if empty)
ADS_LOCAL_PORT=                  # Local ADS port (auto-assign if empty)

# Connection Settings
ADS_TIMEOUT=5000                 # Timeout in milliseconds (default: 5000)
ADS_MAX_RETRIES=3                # Retry attempts (default: 3)
ADS_RETRY_BACKOFF_BASE=0.5       # Backoff base in seconds (default: 0.5)

# TwinCAT Settings
ADS_SYSTEM_SERVICE_PORT=10000    # System service port (default: 10000)
ADS_PLC_TC2_PORT=801             # TwinCAT 2 PLC port (default: 801)
ADS_PLC_TC3_PORT=851             # TwinCAT 3 PLC port (default: 851)

# Notification Settings
ADS_NOTIFICATION_CYCLE=100       # Default notification cycle in ms (default: 100)
ADS_NOTIFICATION_MAX_DELAY=200   # Max notification delay in ms (default: 200)

# Security Settings
ADS_WRITES_ENABLED=true          # Allow write operations (default: true)
ADS_CONTROL_CMDS_ENABLED=false   # Allow control commands (default: false)

# Symbol Map
SYMBOL_MAP_FILE=/path/to/symbols.json  # Optional symbol configuration file

# Debugging
ADS_DEBUG=false                  # Enable debug logging (default: false)
ADS_LOG_PACKETS=false            # Log ADS packets (default: false)
```

## Implementation Phases

### Phase 1: Project Setup & Foundation ✅
- [ ] Create directory structure
- [ ] Set up .gitignore files (Python, Node, IDE files)
- [ ] Initialize Python project with uv
  - [ ] Create pyproject.toml
  - [ ] Set Python version (.python-version file)
  - [ ] Configure dependencies (pyads, mcp, dotenv)
- [ ] Initialize NPM project
  - [ ] Create package.json with bin entry
  - [ ] Configure TypeScript (tsconfig.json)
  - [ ] Add dependencies (MCP SDK, ads-client)
- [ ] Create main README.md

### Phase 2: Python MCP Server (ads-python)
- [ ] Core infrastructure
  - [ ] Set up MCP server scaffold (server.py)
  - [ ] Create ADS client wrapper (ads_client.py)
  - [ ] Implement AMS route management
  - [ ] Add environment variable configuration
  - [ ] Create CLI entry point (cli.py)
- [ ] Symbol operations
  - [ ] read_symbol tool
  - [ ] write_symbol tool
  - [ ] read_symbols tool
  - [ ] write_symbols tool
- [ ] Handle operations
  - [ ] get_handle tool
  - [ ] read_by_handle tool
  - [ ] write_by_handle tool
  - [ ] release_handle tool
  - [ ] read_write_handle tool
- [ ] Notification/COV operations
  - [ ] add_notification tool
  - [ ] delete_notification tool
  - [ ] get_notifications tool
  - [ ] Notification callback handler
- [ ] Index group/offset operations
  - [ ] read_by_index tool
  - [ ] write_by_index tool
  - [ ] read_device_info tool
  - [ ] read_state tool
- [ ] Device state control
  - [ ] read_state tool
  - [ ] write_control tool
  - [ ] read_device_state tool
  - [ ] start_plc tool
  - [ ] stop_plc tool
  - [ ] reset_plc tool
- [ ] Upload/download operations
  - [ ] upload_info tool
  - [ ] download_data tool
  - [ ] read_list tool
- [ ] Symbol map system
  - [ ] Symbol file parser (JSON)
  - [ ] list_symbols tool
  - [ ] read_symbol_by_alias tool
  - [ ] write_symbol_by_alias tool
- [ ] Data type conversions
  - [ ] read_bool tool
  - [ ] read_int tool
  - [ ] read_uint tool
  - [ ] read_real tool
  - [ ] read_string tool
  - [ ] read_time tool
  - [ ] read_struct tool
- [ ] Route management
  - [ ] add_route tool
  - [ ] delete_route tool
  - [ ] get_local_address tool
- [ ] Diagnostics & health
  - [ ] ping tool
  - [ ] get_timeout tool
  - [ ] set_timeout tool
  - [ ] read_device_info tool
  - [ ] test_connection tool
- [ ] Error handling & validation
  - [ ] Unified response format: `{success, data, error, meta}`
  - [ ] Input validation for all tools
  - [ ] ADS error code translation
  - [ ] Comprehensive error messages
- [ ] Documentation
  - [ ] README.md with installation, configuration, examples
  - [ ] Tool documentation with schemas
  - [ ] Symbol mapping guide
  - [ ] AMS addressing guide
  - [ ] MCP client configuration examples

### Phase 3: NPM/TypeScript MCP Server (ads-npm)
- [ ] Port Python implementation to TypeScript
  - [ ] MCP server setup
  - [ ] ADS client implementation (ads-client)
  - [ ] Route management
  - [ ] Environment configuration
- [ ] Implement all tools (matching Python API)
  - [ ] Symbol operations
  - [ ] Handle operations
  - [ ] Notification/COV operations
  - [ ] Index group/offset operations
  - [ ] Device state control
  - [ ] Upload/download operations
  - [ ] Symbol map system
  - [ ] Data type conversions
  - [ ] Route management
  - [ ] Diagnostics & health
- [ ] Build & packaging
  - [ ] TypeScript compilation
  - [ ] NPX compatibility
  - [ ] Create mcp-config-example.json
- [ ] Testing
  - [ ] Verify tool parity with Python version
  - [ ] Test NPX execution
- [ ] Documentation
  - [ ] README.md for NPM package
  - [ ] Installation guide
  - [ ] Claude Desktop configuration

### Phase 4: Mock TwinCAT PLC (ads-mock-plc)
- [ ] PLC implementation
  - [ ] ADS/AMS server stack
  - [ ] Symbol database
  - [ ] Handle management
  - [ ] Notification system
- [ ] Symbol database
  - [ ] BOOL, INT, DINT, LINT types
  - [ ] UINT, UDINT, ULINT types
  - [ ] REAL, LREAL types
  - [ ] STRING types
  - [ ] Structured types
  - [ ] Array types
- [ ] Test data
  - [ ] Pre-configured symbols
  - [ ] Simulated variables
  - [ ] Various data types
  - [ ] Realistic automation scenarios
- [ ] Features
  - [ ] TCP server (AMS protocol)
  - [ ] Console logging for all operations
  - [ ] CLI controls for changing values
  - [ ] Auto-updating symbol values
  - [ ] Device state simulation
  - [ ] Notification callbacks
- [ ] Documentation
  - [ ] README.md with PLC configuration
  - [ ] Symbol database documentation
  - [ ] Usage examples
  - [ ] Integration testing guide

### Phase 5: Testing & Integration
- [ ] Unit tests
  - [ ] Python tool tests
  - [ ] TypeScript tool tests
  - [ ] Mock PLC tests
- [ ] Integration tests
  - [ ] Python MCP server ↔ Mock PLC
  - [ ] NPM MCP server ↔ Mock PLC
  - [ ] Tool output consistency between Python/NPM
  - [ ] Multi-PLC scenarios
- [ ] Real hardware testing
  - [ ] Test with TwinCAT 3 systems
  - [ ] Test with TwinCAT 2 systems
  - [ ] Test with CX/CP series PLCs
  - [ ] Verify all tools work correctly
  - [ ] Performance benchmarking
- [ ] MCP client testing
  - [ ] Claude Desktop integration
  - [ ] MCP Inspector testing
  - [ ] Multi-tool workflow tests

### Phase 6: Documentation & Polish
- [ ] Main README.md
  - [ ] Project overview
  - [ ] Quick start guide
  - [ ] Architecture overview
  - [ ] ADS Protocol overview
  - [ ] AMS addressing
  - [ ] Feature comparison with MODBUS-Project
- [ ] Individual component READMEs
  - [ ] Complete API documentation
  - [ ] Environment variable reference
  - [ ] Troubleshooting guides
  - [ ] Symbol mapping guide
  - [ ] Example use cases
- [ ] MCP configuration examples
  - [ ] Claude Desktop configs (Python & NPM)
  - [ ] Other MCP client examples
- [ ] Symbol map examples
  - [ ] Sample symbol files for common scenarios
  - [ ] Naming conventions
  - [ ] Best practices
- [ ] Video/GIF demonstrations
  - [ ] Setup and connection
  - [ ] Common operations
  - [ ] AI agent interaction examples

## Code Structure Details

### Python Server Architecture

```python
# src/ads_mcp/server.py
class ADSMCPServer:
    def __init__(self):
        self.client = ADSClient()
        self.symbol_map = SymbolMap()
        
    async def run(self):
        # Initialize MCP server
        # Register all tools
        # Start stdio transport

# src/ads_mcp/ads_client.py
import pyads

class ADSClient:
    def __init__(self, net_id='127.0.0.1.1.1', port=851):
        self.plc = pyads.Connection(net_id, port)
        
    def read_symbol(self, symbol_name):
        # Read variable by symbol name
        
    def write_symbol(self, symbol_name, value):
        # Write variable by symbol name
        
    def add_notification(self, symbol_name, callback):
        # Add notification for variable
```

### NPM Server Architecture

```typescript
// src/index.ts
import { Client } from 'ads-client';

class ADSMCPServer {
  private client: Client;
  private symbolMap: SymbolMap;
  
  async run() {
    // Initialize MCP server
    // Register tools
    // Start stdio transport
  }
}

// ADS client wrapper
class ADSClient {
  private client: Client;
  
  constructor(amsNetId: string = '127.0.0.1.1.1', amsPort: number = 851) {
    this.client = new Client({
      targetAmsNetId: amsNetId,
      targetAdsPort: amsPort
    });
  }
  
  async readSymbol(symbolName: string): Promise<any> { }
  async writeSymbol(symbolName: string, value: any): Promise<void> { }
  async addNotification(symbolName: string, callback: Function): Promise<void> { }
}
```

## Tool Response Format

All tools return a consistent format:

```json
{
  "success": true,
  "data": {
    "symbol": "MAIN.ConveyorSpeed",
    "value": 1500,
    "data_type": "INT"
  },
  "error": null,
  "meta": {
    "timestamp": "2025-11-28T20:18:00Z",
    "plc_net_id": "127.0.0.1.1.1",
    "plc_port": 851,
    "device_state": "RUN",
    "execution_time_ms": 12
  }
}
```

## Example Tool Calls

### Read Symbol
```json
{
  "tool": "read_symbol",
  "parameters": {
    "symbol_name": "MAIN.ConveyorSpeed"
  }
}
```

### Write Symbol
```json
{
  "tool": "write_symbol",
  "parameters": {
    "symbol_name": "MAIN.ConveyorSpeed",
    "value": 1500
  }
}
```

### Add Notification
```json
{
  "tool": "add_notification",
  "parameters": {
    "symbol_name": "MAIN.Sensors.rTemp",
    "cycle_time": 100
  }
}
```

### Read by Index
```json
{
  "tool": "read_by_index",
  "parameters": {
    "index_group": 16448,
    "index_offset": 0,
    "data_type": "UDINT"
  }
}
```

### Start PLC
```json
{
  "tool": "start_plc",
  "parameters": {}
}
```

### Using Symbol Map (Alias)
```json
{
  "tool": "read_symbol_by_alias",
  "parameters": {
    "alias": "ConveyorSpeed"
  }
}
```

## Dependencies & Requirements

### System Requirements
- **Python**: 3.10 or higher
- **Node.js**: 18 or higher (for NPM version)
- **uv**: For Python dependency management
- **Network Access**: TCP connectivity to TwinCAT system
- **TwinCAT Router**: Installed on local system (for routing)

### Python Dependencies
```toml
dependencies = [
    "mcp[cli]>=1.6.0",
    "pyads>=3.4.0",
    "python-dotenv>=1.1.0",
]
```

### NPM Dependencies
```json
"dependencies": {
  "@modelcontextprotocol/sdk": "^1.2.0",
  "dotenv": "^16.4.5",
  "ads-client": "^1.15.0"
}
```

## Security Considerations

1. **Write Protection**: Default `ADS_WRITES_ENABLED=true` with option to disable
2. **Control Commands**: `ADS_CONTROL_CMDS_ENABLED=false` by default
3. **Input Validation**: All tool inputs validated before ADS operations
4. **Route Authentication**: AMS route requires authorization
5. **Network Isolation**: Recommend dedicated automation network
6. **Audit Logging**: Optional logging of all write and control operations

## Testing Strategy

### Mock PLC Test Cases
1. **Symbol Reading**: Read all data types
2. **Symbol Writing**: Write various data types
3. **Notifications**: Add, receive, delete notifications
4. **Handle Operations**: Get, read, write, release handles
5. **Device Control**: Start, stop, reset
6. **Error Handling**: Invalid symbols, communication failures
7. **Symbol Map System**: Alias resolution, read/write by alias

### Real Hardware Testing
- Test with TwinCAT 3 systems
- Test with TwinCAT 2 systems
- Test with CX series IPCs
- Test with CP series panel PCs
- Verify data integrity
- Performance testing (latency, throughput)
- Notification response times
- Multi-PLC scenarios

## Performance Targets

- **Symbol Read**: < 30ms
- **Symbol Write**: < 50ms
- **Handle Read**: < 20ms
- **Notification Latency**: < 50ms (from change to notification)
- **Multiple Read**: < 80ms (10 symbols)
- **Device State**: < 15ms

## Troubleshooting Guide

Common issues and solutions to document:

1. **Connection Failed**
   - Verify AMS Net ID is correct
   - Check TwinCAT Router is running
   - Ensure route is added
   - Verify firewall allows AMS traffic

2. **Route Not Found**
   - Add route manually or programmatically
   - Check route permissions
   - Verify local AMS Net ID
   - Restart TwinCAT Router

3. **Write Failed**
   - Check write protection
   - Verify PLC is in correct mode
   - Check symbol is writable
   - Review ADS_WRITES_ENABLED setting

4. **Symbol Not Found**
   - Verify symbol name is correct (case-sensitive)
   - Check PLC program is running
   - Ensure symbol exists in project
   - Upload symbol information

5. **Notification Not Working**
   - Check cycle time setting
   - Verify symbol supports notifications
   - Ensure connection is maintained
   - Review max notifications limit

## ADS Protocol Details

### AMS Addressing
- **AMS Net ID**: 6-byte identifier (e.g., 192.168.1.2.1.1)
- **ADS Port**: 16-bit port number
  - 10000: System Service
  - 801: TwinCAT 2 PLC
  - 851: TwinCAT 3 PLC Runtime 1
  - 852: TwinCAT 3 PLC Runtime 2

### Index Groups (Common)
- **0x4020**: Read/write by symbol handle
- **0x4040**: Read/write by symbol name
- **0xF020**: Module parameter
- **0xF030**: Diagnostic data

### Device States
- **INVALID**: Invalid state
- **IDLE**: No task running
- **RESET**: Reset
- **INIT**: Initialized
- **START**: Starting
- **RUN**: Running
- **STOP**: Stopped

### Supported Platforms
- **TwinCAT 3**: XAR, XAE
- **TwinCAT 2**: Full support
- **CX Series**: CX5xxx, CX9xxx IPCs
- **CP Series**: CP6xxx panel PCs
- **Other**: Any ADS-capable device

## Future Enhancements

- [ ] TwinCAT HMI integration
- [ ] Motion control (NC) support
- [ ] EtherCAT slave diagnostics via ADS
- [ ] File operations (upload/download)
- [ ] License management
- [ ] Task status monitoring
- [ ] Web UI for symbol visualization
- [ ] Integration with Visual Studio TwinCAT XAE
- [ ] Multi-runtime support
- [ ] Advanced data logging

## Success Criteria

This project will be considered complete when:

1. ✅ Both Python and NPM servers are fully functional
2. ✅ All core tools are implemented and tested
3. ✅ Mock PLC provides realistic testing environment
4. ✅ Symbol read/write operations work reliably
5. ✅ Notification system functions correctly
6. ✅ Device control operations work properly
7. ✅ Comprehensive documentation is complete
8. ✅ Successfully tested with real TwinCAT systems
9. ✅ Claude Desktop integration works seamlessly
10. ✅ Performance targets are met
11. ✅ Security best practices are implemented

## Timeline Estimate

- **Phase 1** (Setup): 1-2 days
- **Phase 2** (Python Server): 7-10 days
- **Phase 3** (NPM Server): 4-6 days
- **Phase 4** (Mock PLC): 3-5 days
- **Phase 5** (Testing): 4-6 days
- **Phase 6** (Documentation): 2-3 days

**Total Estimated Time**: 21-32 days

## References

- [Beckhoff ADS Documentation](https://infosys.beckhoff.com/english.php?content=../content/1033/tc3_ads_intro/index.html)
- [pyads Documentation](https://pyads.readthedocs.io/)
- [ads-client Documentation](https://github.com/jisotalo/ads-client)
- [TwinCAT System Reference](https://infosys.beckhoff.com/)
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [MODBUS-Project Reference](../../MODBUS-Project/)

---

**Document Version**: 1.0  
**Created**: 2025-11-28  
**Last Updated**: 2025-11-28  
**Status**: Planning Phase
