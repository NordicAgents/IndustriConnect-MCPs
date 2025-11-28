# DNP3 MCP Server - Implementation Plan
## SCADA & Utilities Protocol

## Project Overview

This plan outlines the development of a **Model Context Protocol (MCP) server for DNP3** (Distributed Network Protocol 3) - the industry-standard protocol for SCADA systems in electric utilities, water/wastewater, and other critical infrastructure. The implementation will follow the proven architecture from the MODBUS-Project, enabling AI agents and MCP-compatible applications to communicate with DNP3 outstations and masters.

## Project Goals

- Create a production-ready MCP server for DNP3 protocol
- Support both Python and NPM/TypeScript implementations
- Provide comprehensive tooling for master/outstation operations, data acquisition, and control
- Include a mock DNP3 outstation for testing and development
- Maintain consistency with the MODBUS-Project architecture and patterns
- Enable seamless AI agent integration with SCADA/utility systems
- Support DNP3 over serial and TCP/IP

## Repository Structure

```
DNP3-Project/
├── .gitignore                    # Combined ignore patterns (Python, Node, IDE)
├── README.md                     # Main project documentation
├── dnp3-python/                  # Python MCP server implementation
│   ├── .gitignore
│   ├── .python-version
│   ├── README.md
│   ├── pyproject.toml           # uv/pip configuration
│   ├── uv.lock
│   └── src/
│       └── dnp3_mcp/
│           ├── __init__.py
│           ├── cli.py           # Entry point (dnp3-mcp command)
│           ├── server.py        # MCP server implementation
│           ├── tools.py         # DNP3 tool definitions
│           └── dnp3_master.py   # DNP3 master wrapper
├── dnp3-npm/                    # NPM/TypeScript MCP server
│   ├── .gitignore
│   ├── README.md
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── mcp-config-example.json
│   └── src/
│       └── index.ts             # Main MCP server + tools
└── dnp3-mock-outstation/        # Mock DNP3 outstation for testing
    ├── .gitignore
    ├── README.md
    ├── pyproject.toml
    └── dnp3_mock_outstation.py  # Simulated DNP3 outstation
```

## Technology Stack

### Python Implementation (dnp3-python)
- **Python**: 3.10+
- **Package Manager**: uv (modern, fast dependency manager)
- **MCP SDK**: `mcp[cli]>=1.6.0`
- **DNP3 Protocol**: `pydnp3>=0.2.3` or `opendnp3` bindings
- **Serial Communication**: `pyserial>=3.5` (for serial DNP3)
- **Environment**: `python-dotenv>=1.1.0`
- **Build System**: hatchling

### NPM Implementation (dnp3-npm)
- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.6+
- **MCP SDK**: `@modelcontextprotocol/sdk@^1.2.0`
- **DNP3 Protocol**: `node-opendnp3` bindings or custom implementation
- **Serial Communication**: `serialport@^12.0.0` (for serial DNP3)
- **Environment**: `dotenv@^16.4.5`
- **Build**: TypeScript compiler

### Mock Outstation (dnp3-mock-outstation)
- **Python**: 3.10+
- **Framework**: Custom DNP3 outstation implementation using pydnp3
- **Package Manager**: uv

## Core Features & Tools

### 1. Point Reading Operations
- **read_binary_inputs**: Read binary input points (status indicators)
  - Parameters: outstation_address, start_index, count
- **read_binary_outputs**: Read binary output points (control status)
- **read_analog_inputs**: Read analog input points (measurements)
- **read_analog_outputs**: Read analog output points (setpoints)
- **read_counters**: Read counter points (accumulated values)
- **read_all_points**: Read all configured points from outstation

### 2. Control Operations
- **write_binary_output**: Operate binary output (CROB - Control Relay Output Block)
  - Parameters: outstation_address, index, value, control_code
- **write_analog_output**: Set analog output value
  - Parameters: outstation_address, index, value
- **select_before_operate**: SBO (Select Before Operate) control sequence
- **direct_operate**: Direct operate without select

### 3. Data Acquisition
- **poll_class_0**: Poll static (current) data
- **poll_class_1**: Poll Class 1 events (high priority)
- **poll_class_2**: Poll Class 2 events (medium priority)
- **poll_class_3**: Poll Class 3 events (low priority)
- **enable_unsolicited**: Enable unsolicited responses
- **disable_unsolicited**: Disable unsolicited responses

### 4. Time Synchronization
- **sync_time**: Synchronize outstation time with master
- **get_outstation_time**: Read outstation time
- **record_current_time**: Record time at outstation

### 5. File Transfer
- **read_file**: Read file from outstation
- **write_file**: Write file to outstation
- **get_file_info**: Get file information
- **delete_file**: Delete file from outstation

### 6. Configuration & Management
- **get_outstation_info**: Get outstation configuration
- **cold_restart**: Perform cold restart
- **warm_restart**: Perform warm restart
- **clear_restart_bit**: Clear restart IIN bit
- **scan_outstations**: Scan for DNP3 outstations on network

### 7. Point Map System
- **list_points**: List all configured points from map
- **read_point_by_alias**: Read by alias name
- **write_point_by_alias**: Write by alias name
- Point configuration file format (JSON):
```json
{
  "BreakerStatus": {
    "outstation": 10,
    "type": "binary_input",
    "index": 0,
    "description": "Main breaker status",
    "tags": ["protection", "critical"]
  },
  "VoltageL1": {
    "outstation": 10,
    "type": "analog_input",
    "index": 0,
    "description": "Line 1 voltage",
    "unit": "V",
    "deadband": 0.5,
    "class": 1
  },
  "PumpControl": {
    "outstation": 10,
    "type": "binary_output",
    "index": 5,
    "description": "Pump on/off control",
    "control_code": "LATCH_ON"
  },
  "FlowSetpoint": {
    "outstation": 10,
    "type": "analog_output",
    "index": 2,
    "description": "Flow rate setpoint",
    "unit": "GPM",
    "min": 0,
    "max": 1000
  }
}
```

### 8. Security & Authentication
- **configure_authentication**: Configure DNP3-SA (Secure Authentication)
- **update_keys**: Update authentication keys
- **get_security_stats**: Get security statistics

### 9. Diagnostics & Health
- **ping**: Connection health check and configuration report
- **get_link_status**: Get link layer status
- **get_iins**: Read Internal Indication bits
- **test_outstation_communication**: Test communication with specific outstation
- **get_communication_stats**: Get communication statistics

## Environment Variables

```bash
# Connection Settings
DNP3_CONNECTION_TYPE=tcp         # Connection type: tcp or serial (default: tcp)
DNP3_HOST=192.168.1.10          # IP address for TCP (default: 127.0.0.1)
DNP3_PORT=20000                  # Port for TCP (default: 20000)
DNP3_SERIAL_PORT=/dev/ttyUSB0    # Serial port for serial connection

# Master Settings
DNP3_MASTER_ADDRESS=1            # Master link address (default: 1)
DNP3_LOCAL_ADDRESS=1             # Local DNP3 address (default: 1)

# Protocol Settings
DNP3_TIMEOUT=5000                # Response timeout in milliseconds (default: 5000)
DNP3_MAX_RETRIES=3               # Retry attempts (default: 3)
DNP3_FRAGMENT_SIZE=2048          # Max fragment size in bytes (default: 2048)

# Link Layer
DNP3_LINK_TIMEOUT=1000           # Link layer timeout in ms (default: 1000)
DNP3_KEEP_ALIVE=true             # Enable keep-alive (default: true)
DNP3_KEEP_ALIVE_INTERVAL=15000   # Keep-alive interval in ms (default: 15000)

# Application Layer
DNP3_UNSOLICITED_ENABLED=true    # Enable unsolicited responses (default: true)
DNP3_TIME_SYNC_MODE=LAN          # Time sync mode: LAN or NON_LAN (default: LAN)
DNP3_EVENT_SCAN_RATE=5000        # Event scan rate in ms (default: 5000)

# Class Scanning
DNP3_CLASS_0_INTERVAL=60000      # Class 0 poll interval in ms (default: 60000)
DNP3_CLASS_1_INTERVAL=5000       # Class 1 poll interval in ms (default: 5000)
DNP3_CLASS_2_INTERVAL=10000      # Class 2 poll interval in ms (default: 10000)
DNP3_CLASS_3_INTERVAL=30000      # Class 3 poll interval in ms (default: 30000)

# Security Settings
DNP3_WRITES_ENABLED=true         # Allow write operations (default: true)
DNP3_SECURE_AUTH_ENABLED=false   # Enable DNP3-SA (default: false)
DNP3_AUTH_KEY=                   # Authentication key (if SA enabled)

# Point Map
POINT_MAP_FILE=/path/to/points.json  # Optional point configuration file

# Debugging
DNP3_DEBUG=false                 # Enable debug logging (default: false)
DNP3_LOG_FRAGMENTS=false         # Log DNP3 fragments (default: false)
DNP3_LOG_LINK_LAYER=false        # Log link layer frames (default: false)
```

## Implementation Phases

### Phase 1: Project Setup & Foundation ✅
- [ ] Create directory structure
- [ ] Set up .gitignore files (Python, Node, IDE files)
- [ ] Initialize Python project with uv
  - [ ] Create pyproject.toml
  - [ ] Set Python version (.python-version file)
  - [ ] Configure dependencies (pydnp3, mcp, dotenv)
- [ ] Initialize NPM project
  - [ ] Create package.json with bin entry
  - [ ] Configure TypeScript (tsconfig.json)
  - [ ] Add dependencies (MCP SDK, opendnp3 bindings)
- [ ] Create main README.md

### Phase 2: Python MCP Server (dnp3-python)
- [ ] Core infrastructure
  - [ ] Set up MCP server scaffold (server.py)
  - [ ] Create DNP3 master wrapper (dnp3_master.py)
  - [ ] Implement connection management (TCP and serial)
  - [ ] Implement master channel and association
  - [ ] Add environment variable configuration
  - [ ] Create CLI entry point (cli.py)
- [ ] Point reading operations
  - [ ] read_binary_inputs tool
  - [ ] read_binary_outputs tool
  - [ ] read_analog_inputs tool
  - [ ] read_analog_outputs tool
  - [ ] read_counters tool
  - [ ] read_all_points tool
- [ ] Control operations
  - [ ] write_binary_output tool
  - [ ] write_analog_output tool
  - [ ] select_before_operate tool
  - [ ] direct_operate tool
- [ ] Data acquisition
  - [ ] poll_class_0 tool
  - [ ] poll_class_1 tool
  - [ ] poll_class_2 tool
  - [ ] poll_class_3 tool
  - [ ] enable_unsolicited tool
  - [ ] disable_unsolicited tool
- [ ] Time synchronization
  - [ ] sync_time tool
  - [ ] get_outstation_time tool
  - [ ] record_current_time tool
- [ ] File transfer
  - [ ] read_file tool
  - [ ] write_file tool
  - [ ] get_file_info tool
  - [ ] delete_file tool
- [ ] Configuration & management
  - [ ] get_outstation_info tool
  - [ ] cold_restart tool
  - [ ] warm_restart tool
  - [ ] clear_restart_bit tool
  - [ ] scan_outstations tool
- [ ] Point map system
  - [ ] Point file parser (JSON)
  - [ ] list_points tool
  - [ ] read_point_by_alias tool
  - [ ] write_point_by_alias tool
- [ ] Security & authentication
  - [ ] configure_authentication tool
  - [ ] update_keys tool
  - [ ] get_security_stats tool
- [ ] Diagnostics & health
  - [ ] ping tool
  - [ ] get_link_status tool
  - [ ] get_iins tool
  - [ ] test_outstation_communication tool
  - [ ] get_communication_stats tool
- [ ] Error handling & validation
  - [ ] Unified response format: `{success, data, error, meta}`
  - [ ] Input validation for all tools
  - [ ] DNP3 status code translation
  - [ ] IIN bit interpretation
  - [ ] Comprehensive error messages
- [ ] Documentation
  - [ ] README.md with installation, configuration, examples
  - [ ] Tool documentation with schemas
  - [ ] Point mapping guide
  - [ ] Class polling configuration guide
  - [ ] MCP client configuration examples

### Phase 3: NPM/TypeScript MCP Server (dnp3-npm)
- [ ] Port Python implementation to TypeScript
  - [ ] MCP server setup
  - [ ] DNP3 master implementation
  - [ ] Connection management (TCP and serial)
  - [ ] Environment configuration
- [ ] Implement all tools (matching Python API)
  - [ ] Point reading operations
  - [ ] Control operations
  - [ ] Data acquisition
  - [ ] Time synchronization
  - [ ] File transfer
  - [ ] Configuration & management
  - [ ] Point map system
  - [ ] Security & authentication
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

### Phase 4: Mock DNP3 Outstation (dnp3-mock-outstation)
- [ ] Outstation implementation
  - [ ] DNP3 outstation protocol stack
  - [ ] Link layer implementation
  - [ ] Application layer implementation
  - [ ] Configurable outstation address
- [ ] Point database
  - [ ] Binary inputs (status points)
  - [ ] Binary outputs (control points)
  - [ ] Analog inputs (measurements)
  - [ ] Analog outputs (setpoints)
  - [ ] Counters (accumulated values)
- [ ] Test data
  - [ ] Pre-configured point database
  - [ ] Simulated process data
  - [ ] Event generation
  - [ ] Realistic SCADA scenarios
- [ ] Features
  - [ ] TCP and serial support
  - [ ] Console logging for all operations
  - [ ] CLI controls for changing values
  - [ ] Auto-updating measurements
  - [ ] Event simulation
  - [ ] Unsolicited response support
  - [ ] Time synchronization support
- [ ] Documentation
  - [ ] README.md with outstation configuration
  - [ ] Point database documentation
  - [ ] Usage examples
  - [ ] Integration testing guide

### Phase 5: Testing & Integration
- [ ] Unit tests
  - [ ] Python tool tests
  - [ ] TypeScript tool tests
  - [ ] Mock outstation tests
- [ ] Integration tests
  - [ ] Python MCP server ↔ Mock outstation
  - [ ] NPM MCP server ↔ Mock outstation
  - [ ] Tool output consistency between Python/NPM
  - [ ] Multi-outstation scenarios
- [ ] Real hardware testing
  - [ ] Test with real DNP3 outstations
  - [ ] Test with RTUs and intelligent devices
  - [ ] Verify all tools work correctly
  - [ ] Performance benchmarking
  - [ ] Event handling validation
- [ ] MCP client testing
  - [ ] Claude Desktop integration
  - [ ] MCP Inspector testing
  - [ ] Multi-tool workflow tests

### Phase 6: Documentation & Polish
- [ ] Main README.md
  - [ ] Project overview
  - [ ] Quick start guide
  - [ ] Architecture overview
  - [ ] DNP3 protocol overview
  - [ ] SCADA system integration
  - [ ] Feature comparison with MODBUS-Project
- [ ] Individual component READMEs
  - [ ] Complete API documentation
  - [ ] Environment variable reference
  - [ ] Troubleshooting guides
  - [ ] Point mapping guide
  - [ ] Event class configuration
  - [ ] Example use cases
- [ ] MCP configuration examples
  - [ ] Claude Desktop configs (Python & NPM)
  - [ ] Other MCP client examples
- [ ] Point map examples
  - [ ] Sample point files for common scenarios
  - [ ] Naming conventions
  - [ ] Best practices
- [ ] Video/GIF demonstrations
  - [ ] Setup and outstation scanning
  - [ ] Common operations
  - [ ] AI agent interaction examples

## Code Structure Details

### Python Server Architecture

```python
# src/dnp3_mcp/server.py
class DNP3MCPServer:
    def __init__(self):
        self.master = DNP3Master()
        self.point_map = PointMap()
        
    async def run(self):
        # Initialize MCP server
        # Register all tools
        # Start stdio transport

# src/dnp3_mcp/dnp3_master.py
from pydnp3 import opendnp3

class DNP3Master:
    def __init__(self, host='127.0.0.1', port=20000, ...):
        self.manager = opendnp3.DNP3Manager()
        self.channel = None
        self.master = None
        
    def connect(self):
        # Create channel and master
        
    def read_binary_inputs(self, outstation_addr, start, count):
        # Read binary input points
        
    def write_binary_output(self, outstation_addr, index, value):
        # Operate binary output
        
    def poll_class_1(self, outstation_addr):
        # Poll Class 1 events
```

### NPM Server Architecture

```typescript
// src/index.ts
class DNP3MCPServer {
  private master: DNP3Master;
  private pointMap: PointMap;
  
  async run() {
    // Initialize MCP server
    // Register tools
    // Start stdio transport
  }
}

// DNP3 master wrapper
class DNP3Master {
  private manager: any;
  private channel: any;
  
  constructor(host: string = '127.0.0.1', port: number = 20000) {
    // Initialize OpenDNP3
  }
  
  async connect(): Promise<void> { }
  async readBinaryInputs(outstationAddr: number, start: number, count: number): Promise<any[]> { }
  async writeBinaryOutput(outstationAddr: number, index: number, value: boolean): Promise<void> { }
  async pollClass1(outstationAddr: number): Promise<void> { }
}
```

## Tool Response Format

All tools return a consistent format:

```json
{
  "success": true,
  "data": {
    "outstation": 10,
    "points": [
      {
        "index": 0,
        "value": true,
        "quality": "ONLINE",
        "timestamp": "2025-11-28T19:45:00Z"
      },
      {
        "index": 1,
        "value": false,
        "quality": "ONLINE",
        "timestamp": "2025-11-28T19:45:00Z"
      }
    ]
  },
  "error": null,
  "meta": {
    "timestamp": "2025-11-28T19:45:09Z",
    "connection": "192.168.1.10:20000",
    "outstation_address": 10,
    "execution_time_ms": 45,
    "iins": ["RESTART", "DEVICE_TROUBLE"]
  }
}
```

## Example Tool Calls

### Read Binary Inputs
```json
{
  "tool": "read_binary_inputs",
  "parameters": {
    "outstation_address": 10,
    "start_index": 0,
    "count": 16
  }
}
```

### Read Analog Inputs
```json
{
  "tool": "read_analog_inputs",
  "parameters": {
    "outstation_address": 10,
    "start_index": 0,
    "count": 8
  }
}
```

### Write Binary Output
```json
{
  "tool": "write_binary_output",
  "parameters": {
    "outstation_address": 10,
    "index": 5,
    "value": true,
    "control_code": "LATCH_ON"
  }
}
```

### Poll Class 1 Events
```json
{
  "tool": "poll_class_1",
  "parameters": {
    "outstation_address": 10
  }
}
```

### Sync Time
```json
{
  "tool": "sync_time",
  "parameters": {
    "outstation_address": 10
  }
}
```

### Using Point Map (Alias)
```json
{
  "tool": "read_point_by_alias",
  "parameters": {
    "alias": "BreakerStatus"
  }
}
```

## Dependencies & Requirements

### System Requirements
- **Python**: 3.10 or higher
- **Node.js**: 18 or higher (for NPM version)
- **uv**: For Python dependency management
- **Network Access**: TCP connectivity to DNP3 outstations
- **Serial Port**: For serial DNP3 connections (optional)

### Python Dependencies
```toml
dependencies = [
    "mcp[cli]>=1.6.0",
    "pydnp3>=0.2.3",
    "pyserial>=3.5",
    "python-dotenv>=1.1.0",
]
```

### NPM Dependencies
```json
"dependencies": {
  "@modelcontextprotocol/sdk": "^1.2.0",
  "dotenv": "^16.4.5",
  "serialport": "^12.0.0"
}
```

## Security Considerations

1. **Write Protection**: Default `DNP3_WRITES_ENABLED=true` with option to disable
2. **Secure Authentication**: `DNP3_SECURE_AUTH_ENABLED=false` by default (DNP3-SA)
3. **Input Validation**: All tool inputs validated before DNP3 operations
4. **Network Isolation**: Recommend dedicated SCADA network
5. **Audit Logging**: Optional logging of all write and control operations
6. **Access Control**: Implement role-based access for control operations

## Testing Strategy

### Mock Outstation Test Cases
1. **Point Reading**: Read all point types
2. **Control Operations**: Binary and analog output controls
3. **Event Handling**: Class 1/2/3 events
4. **Unsolicited Responses**: Enable/disable unsolicited
5. **Time Synchronization**: Time sync operations
6. **File Transfer**: Read/write files
7. **Error Handling**: Communication failures, invalid addresses
8. **Point Map System**: Alias resolution, read/write by alias

### Real Hardware Testing
- Test with real DNP3 RTUs
- Test with intelligent electronic devices (IEDs)
- Verify data integrity
- Performance testing (latency, throughput)
- Multi-outstation scenarios
- Event response times
- Unsolicited response handling

## Performance Targets

- **Point Read**: < 100ms
- **Control Operation**: < 200ms
- **Class Poll**: < 500ms (depends on data volume)
- **Event Response**: < 50ms
- **Time Sync**: < 200ms
- **Unsolicited Event**: < 20ms (from event to receipt)

## Troubleshooting Guide

Common issues and solutions to document:

1. **Connection Failed**
   - Verify IP address and port
   - Check firewall settings
   - Ensure outstation is online
   - Verify master/outstation addresses

2. **No Response**
   - Check link layer status
   - Verify timeout settings
   - Check IIN bits for errors
   - Ensure proper DNP3 configuration

3. **Control Operation Failed**
   - Check write permissions
   - Verify control code
   - Check outstation mode (local/remote)
   - Review IIN bits

4. **Events Not Received**
   - Enable unsolicited responses
   - Check class assignments
   - Verify event buffer not full
   - Check scan rates

5. **Time Sync Issues**
   - Check time sync mode (LAN vs NON_LAN)
   - Verify master clock accuracy
   - Check outstation time sync support

## DNP3 Protocol Details

### Supported Features
- **Point Types**: Binary I/O, Analog I/O, Counters
- **Control**: Direct operate, Select before operate
- **Events**: Class 1/2/3 event data
- **Unsolicited Responses**
- **Time Synchronization** (LAN and NON_LAN)
- **File Transfer**
- **DNP3-SA** (Secure Authentication) - Planned

### Point Quality Flags
- **ONLINE**: Normal operation
- **RESTART**: Device restart detected
- **COMM_LOST**: Communication lost
- **REMOTE_FORCED**: Remote forced value
- **LOCAL_FORCED**: Local forced value
- **OVERRANGE**: Measurement out of range
- **REFERENCE_ERR**: Reference error
- **ROLLOVER**: Counter rollover

### Internal Indication Bits (IINs)
- **DEVICE_RESTART**: Device has restarted
- **DEVICE_TROUBLE**: Device in trouble state
- **EVENT_BUFFER_OVERFLOW**: Event buffer overflow
- **TIME_SYNC_REQUIRED**: Time synchronization needed

## Future Enhancements

- [ ] DNP3-SA (Secure Authentication) v5/v6
- [ ] Advanced Class scanning strategies
- [ ] Data set support
- [ ] Frozen counters
- [ ] Double-bit binary inputs
- [ ] Web UI for SCADA visualization
- [ ] Alarm and event management
- [ ] Historical data logging
- [ ] Multi-master support
- [ ] Integration with HMI systems

## Success Criteria

This project will be considered complete when:

1. ✅ Both Python and NPM servers are fully functional
2. ✅ All core tools are implemented and tested
3. ✅ Mock outstation provides realistic testing environment
4. ✅ Point reading operations work reliably
5. ✅ Control operations function correctly
6. ✅ Event handling works properly
7. ✅ Comprehensive documentation is complete
8. ✅ Successfully tested with real DNP3 devices
9. ✅ Claude Desktop integration works seamlessly
10. ✅ Performance targets are met
11. ✅ Security best practices are implemented

## Timeline Estimate

- **Phase 1** (Setup): 1-2 days
- **Phase 2** (Python Server): 8-12 days
- **Phase 3** (NPM Server): 5-7 days
- **Phase 4** (Mock Outstation): 4-6 days
- **Phase 5** (Testing): 5-7 days
- **Phase 6** (Documentation): 2-3 days

**Total Estimated Time**: 25-37 days

## References

- [DNP3 Specification](https://www.dnp.org/About/Overview-of-DNP3-Protocol)
- [IEEE 1815-2012](https://standards.ieee.org/standard/1815-2012.html)
- [OpenDNP3 Documentation](https://dnp3.github.io/)
- [pydnp3 Documentation](https://github.com/ChargePoint/pydnp3)
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [MODBUS-Project Reference](../../MODBUS-Project/)

---

**Document Version**: 1.0  
**Created**: 2025-11-28  
**Last Updated**: 2025-11-28  
**Status**: Planning Phase
