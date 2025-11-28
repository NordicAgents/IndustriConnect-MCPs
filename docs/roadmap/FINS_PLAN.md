# Omron FINS Protocol MCP Server - Implementation Plan
## Omron PLC Communication Protocol

## Project Overview

This plan outlines the development of a **Model Context Protocol (MCP) server for Omron FINS Protocol** (Factory Interface Network Service) - Omron's communication protocol for SYSMAC series PLCs (CJ, CS, CP, NJ, NX series). The implementation will follow the proven architecture from the MODBUS-Project, enabling AI agents and MCP-compatible applications to communicate with Omron PLCs for manufacturing automation and control.

## Project Goals

- Create a production-ready MCP server for Omron FINS Protocol
- Support both Python and NPM/TypeScript implementations
- Provide comprehensive tooling for memory area operations, I/O control, and monitoring
- Include a mock Omron PLC for testing and development
- Maintain consistency with the MODBUS-Project architecture and patterns
- Enable seamless AI agent integration with Omron automation systems
- Support FINS over TCP/UDP and serial communication

## Repository Structure

```
FINS-Project/
├── .gitignore                    # Combined ignore patterns (Python, Node, IDE)
├── README.md                     # Main project documentation
├── fins-python/                  # Python MCP server implementation
│   ├── .gitignore
│   ├── .python-version
│   ├── README.md
│   ├── pyproject.toml           # uv/pip configuration
│   ├── uv.lock
│   └── src/
│       └── fins_mcp/
│           ├── __init__.py
│           ├── cli.py           # Entry point (fins-mcp command)
│           ├── server.py        # MCP server implementation
│           ├── tools.py         # FINS Protocol tool definitions
│           └── fins_client.py   # FINS Protocol client wrapper
├── fins-npm/                    # NPM/TypeScript MCP server
│   ├── .gitignore
│   ├── README.md
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── mcp-config-example.json
│   └── src/
│       └── index.ts             # Main MCP server + tools
└── fins-mock-plc/               # Mock Omron PLC for testing
    ├── .gitignore
    ├── README.md
    ├── pyproject.toml
    └── fins_mock_plc.py         # Simulated Omron PLC
```

## Technology Stack

### Python Implementation (fins-python)
- **Python**: 3.10+
- **Package Manager**: uv (modern, fast dependency manager)
- **MCP SDK**: `mcp[cli]>=1.6.0`
- **FINS Protocol**: Custom implementation or available libraries
- **Environment**: `python-dotenv>=1.1.0`
- **Build System**: hatchling

### NPM Implementation (fins-npm)
- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.6+
- **MCP SDK**: `@modelcontextprotocol/sdk@^1.2.0`
- **FINS Protocol**: `node-omron-fins` or custom implementation
- **Environment**: `dotenv@^16.4.5`
- **Build**: TypeScript compiler

### Mock PLC (fins-mock-plc)
- **Python**: 3.10+
- **Framework**: Custom FINS Protocol server implementation
- **Package Manager**: uv

## Core Features & Tools

### 1. Memory Area Operations
- **read_memory_area**: Read memory area
  - Parameters: memory_area, address, count
  - Areas: CIO, WR, HR, AR, DM, EM, etc.
- **write_memory_area**: Write memory area
  - Parameters: memory_area, address, values
- **read_multiple_memory**: Read multiple memory areas in one request
- **write_multiple_memory**: Write multiple memory areas in one request

### 2. I/O Operations
- **read_cio**: Read CIO (I/O) area
- **write_cio**: Write CIO (I/O) area
- **read_work**: Read Work (WR) area
- **write_work**: Write Work (WR) area
- **read_holding**: Read Holding (HR) area
- **write_holding**: Write Holding (HR) area
- **read_dm**: Read Data Memory (DM) area
- **write_dm**: Write Data Memory (DM) area

### 3. Bit Operations
- **set_bit**: Set single bit ON
- **reset_bit**: Set single bit OFF
- **toggle_bit**: Toggle bit state
- **read_bits**: Read multiple bits
- **write_bits**: Write multiple bits

### 4. PLC Control
- **read_plc_status**: Read PLC operating status
- **set_plc_mode**: Change PLC mode (RUN/MONITOR/PROGRAM)
- **read_cpu_unit_status**: Get CPU unit status
- **read_cycle_time**: Read PLC cycle time
- **clear_error**: Clear PLC error

### 5. Program Operations
- **read_program**: Read program from PLC
- **write_program**: Write program to PLC
- **verify_program**: Verify program
- **protect_program**: Set program protection
- **clear_program**: Clear program from PLC

### 6. Clock Operations
- **read_clock**: Read PLC clock
- **write_clock**: Set PLC clock
- **sync_clock**: Synchronize PLC clock with system time

### 7. Network Routing
- **set_routing_table**: Configure routing table
- **read_routing_table**: Read routing table
- **send_to_network**: Send command to specific network node

### 8. Memory Map System
- **list_memory**: List all configured memory addresses from map
- **read_memory_by_alias**: Read by alias name
- **write_memory_by_alias**: Write by alias name
- Memory configuration file format (JSON):
```json
{
  "ConveyorSpeed": {
    "memory_area": "DM",
    "address": 1000,
    "word_count": 1,
    "description": "Conveyor belt speed setpoint",
    "data_type": "INT16",
    "unit": "RPM"
  },
  "MotorRunning": {
    "memory_area": "CIO",
    "address": 100,
    "bit": 0,
    "description": "Motor running status",
    "data_type": "BOOL"
  },
  "Temperature": {
    "memory_area": "DM",
    "address": 2000,
    "word_count": 2,
    "description": "Process temperature",
    "data_type": "FLOAT32",
    "unit": "celsius"
  }
}
```

### 9. Data Type Conversions
- **read_int16**: Read as signed 16-bit integer
- **read_uint16**: Read as unsigned 16-bit integer
- **read_int32**: Read as signed 32-bit integer
- **read_uint32**: Read as unsigned 32-bit integer
- **read_float32**: Read as 32-bit float
- **read_string**: Read as ASCII string
- **read_bcd**: Read as BCD (Binary Coded Decimal)

### 10. Diagnostics & Health
- **ping**: Connection health check
- **read_error_log**: Read PLC error log
- **read_message**: Read PLC messages
- **test_connection**: Test communication with PLC
- **get_connection_data**: Get connection configuration

## Environment Variables

```bash
# Connection Settings
FINS_HOST=192.168.1.10           # PLC IP address (default: 192.168.1.10)
FINS_PORT=9600                   # Port for FINS/TCP (default: 9600)
FINS_PROTOCOL=tcp                # Protocol: tcp or udp (default: tcp)

# Network Addressing
FINS_LOCAL_NETWORK=0             # Local network number (default: 0)
FINS_LOCAL_NODE=0                # Local node number (default: 0)
FINS_LOCAL_UNIT=0                # Local unit number (default: 0)
FINS_REMOTE_NETWORK=0            # Remote network number (default: 0)
FINS_REMOTE_NODE=1               # Remote node number (default: 1)
FINS_REMOTE_UNIT=0               # Remote unit number (default: 0)

# Protocol Settings
FINS_TIMEOUT=5000                # Response timeout in milliseconds (default: 5000)
FINS_MAX_RETRIES=3               # Retry attempts (default: 3)
FINS_RETRY_BACKOFF_BASE=0.5      # Backoff base in seconds (default: 0.5)

# Frame Settings
FINS_SID_AUTO=true               # Auto-increment SID (Service ID) (default: true)
FINS_RESPONSE_TIMEOUT=10000      # Response timeout in ms (default: 10000)

# PLC Settings
FINS_PLC_TYPE=NJ                 # PLC type: NJ, NX, CJ, CS, CP (default: NJ)
FINS_CPU_TYPE=NJ501              # CPU type (default: NJ501)

# Security Settings
FINS_WRITES_ENABLED=true         # Allow write operations (default: true)
FINS_MODE_CHANGE_ENABLED=false   # Allow mode changes (default: false)
FINS_PROGRAM_OPS_ENABLED=false   # Allow program operations (default: false)

# Memory Map
MEMORY_MAP_FILE=/path/to/memory.json  # Optional memory configuration file

# Debugging
FINS_DEBUG=false                 # Enable debug logging (default: false)
FINS_LOG_FRAMES=false            # Log FINS frames (default: false)
```

## Implementation Phases

### Phase 1: Project Setup & Foundation ✅
- [ ] Create directory structure
- [ ] Set up .gitignore files (Python, Node, IDE files)
- [ ] Initialize Python project with uv
  - [ ] Create pyproject.toml
  - [ ] Set Python version (.python-version file)
  - [ ] Configure dependencies (mcp, dotenv)
- [ ] Initialize NPM project
  - [ ] Create package.json with bin entry
  - [ ] Configure TypeScript (tsconfig.json)
  - [ ] Add dependencies (MCP SDK)
- [ ] Create main README.md

### Phase 2: Python MCP Server (fins-python)
- [ ] Core infrastructure
  - [ ] Set up MCP server scaffold (server.py)
  - [ ] Create FINS Protocol client wrapper (fins_client.py)
  - [ ] Implement FINS frame encoding/decoding
  - [ ] Implement FINS command/response handling
  - [ ] Add environment variable configuration
  - [ ] Create CLI entry point (cli.py)
- [ ] Memory area operations
  - [ ] read_memory_area tool
  - [ ] write_memory_area tool
  - [ ] read_multiple_memory tool
  - [ ] write_multiple_memory tool
- [ ] I/O operations
  - [ ] read_cio tool
  - [ ] write_cio tool
  - [ ] read_work tool
  - [ ] write_work tool
  - [ ] read_holding tool
  - [ ] write_holding tool
  - [ ] read_dm tool
  - [ ] write_dm tool
- [ ] Bit operations
  - [ ] set_bit tool
  - [ ] reset_bit tool
  - [ ] toggle_bit tool
  - [ ] read_bits tool
  - [ ] write_bits tool
- [ ] PLC control
  - [ ] read_plc_status tool
  - [ ] set_plc_mode tool
  - [ ] read_cpu_unit_status tool
  - [ ] read_cycle_time tool
  - [ ] clear_error tool
- [ ] Program operations
  - [ ] read_program tool
  - [ ] write_program tool
  - [ ] verify_program tool
  - [ ] protect_program tool
  - [ ] clear_program tool
- [ ] Clock operations
  - [ ] read_clock tool
  - [ ] write_clock tool
  - [ ] sync_clock tool
- [ ] Network routing
  - [ ] set_routing_table tool
  - [ ] read_routing_table tool
  - [ ] send_to_network tool
- [ ] Memory map system
  - [ ] Memory file parser (JSON)
  - [ ] list_memory tool
  - [ ] read_memory_by_alias tool
  - [ ] write_memory_by_alias tool
- [ ] Data type conversions
  - [ ] read_int16 tool
  - [ ] read_uint16 tool
  - [ ] read_int32 tool
  - [ ] read_uint32 tool
  - [ ] read_float32 tool
  - [ ] read_string tool
  - [ ] read_bcd tool
- [ ] Diagnostics & health
  - [ ] ping tool
  - [ ] read_error_log tool
  - [ ] read_message tool
  - [ ] test_connection tool
  - [ ] get_connection_data tool
- [ ] Error handling & validation
  - [ ] Unified response format: `{success, data, error, meta}`
  - [ ] Input validation for all tools
  - [ ] FINS error code translation
  - [ ] Comprehensive error messages
- [ ] Documentation
  - [ ] README.md with installation, configuration, examples
  - [ ] Tool documentation with schemas
  - [ ] Memory mapping guide
  - [ ] Memory area reference
  - [ ] MCP client configuration examples

### Phase 3: NPM/TypeScript MCP Server (fins-npm)
- [ ] Port Python implementation to TypeScript
  - [ ] MCP server setup
  - [ ] FINS Protocol client implementation
  - [ ] Frame encoding/decoding
  - [ ] Environment configuration
- [ ] Implement all tools (matching Python API)
  - [ ] Memory area operations
  - [ ] I/O operations
  - [ ] Bit operations
  - [ ] PLC control
  - [ ] Program operations
  - [ ] Clock operations
  - [ ] Network routing
  - [ ] Memory map system
  - [ ] Data type conversions
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

### Phase 4: Mock Omron PLC (fins-mock-plc)
- [ ] PLC implementation
  - [ ] FINS Protocol server stack
  - [ ] Command handler
  - [ ] Response generator
  - [ ] Memory area simulation
- [ ] Memory areas
  - [ ] CIO (I/O) area
  - [ ] WR (Work) area
  - [ ] HR (Holding) area
  - [ ] AR (Auxiliary) area
  - [ ] DM (Data Memory) area
  - [ ] EM (Extended Memory) area
- [ ] Test data
  - [ ] Pre-configured memory
  - [ ] Simulated I/O
  - [ ] Various data types
  - [ ] Realistic manufacturing scenarios
- [ ] Features
  - [ ] TCP/UDP server (port 9600)
  - [ ] Console logging for all operations
  - [ ] CLI controls for changing values
  - [ ] Auto-updating memory values
  - [ ] PLC status simulation
  - [ ] Error simulation
- [ ] Documentation
  - [ ] README.md with PLC configuration
  - [ ] Memory area map
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
  - [ ] Test with Omron NJ series PLCs
  - [ ] Test with NX series PLCs
  - [ ] Test with CJ/CS/CP series PLCs
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
  - [ ] FINS Protocol overview
  - [ ] Memory area reference
  - [ ] Feature comparison with MODBUS-Project
- [ ] Individual component READMEs
  - [ ] Complete API documentation
  - [ ] Environment variable reference
  - [ ] Troubleshooting guides
  - [ ] Memory mapping guide
  - [ ] Example use cases
- [ ] MCP configuration examples
  - [ ] Claude Desktop configs (Python & NPM)
  - [ ] Other MCP client examples
- [ ] Memory map examples
  - [ ] Sample memory files for common scenarios
  - [ ] Naming conventions
  - [ ] Best practices
- [ ] Video/GIF demonstrations
  - [ ] Setup and connection
  - [ ] Common operations
  - [ ] AI agent interaction examples

## Code Structure Details

### Python Server Architecture

```python
# src/fins_mcp/server.py
class FINSMCPServer:
    def __init__(self):
        self.client = FINSClient()
        self.memory_map = MemoryMap()
        
    async def run(self):
        # Initialize MCP server
        # Register all tools
        # Start stdio transport

# src/fins_mcp/fins_client.py
import socket

class FINSClient:
    def __init__(self, host='192.168.1.10', port=9600, protocol='tcp'):
        self.host = host
        self.port = port
        self.protocol = protocol
        
    def read_memory_area(self, area, address, count):
        # Read memory area
        
    def write_memory_area(self, area, address, values):
        # Write memory area
        
    def set_plc_mode(self, mode):
        # Change PLC mode
```

### NPM Server Architecture

```typescript
// src/index.ts
class FINSMCPServer {
  private client: FINSClient;
  private memoryMap: MemoryMap;
  
  async run() {
    // Initialize MCP server
    // Register tools
    // Start stdio transport
  }
}

// FINS Protocol client wrapper
class FINSClient {
  private host: string;
  private port: number;
  private protocol: string;
  
  constructor(host: string = '192.168.1.10', port: number = 9600, protocol: string = 'tcp') {
    this.host = host;
    this.port = port;
    this.protocol = protocol;
  }
  
  async readMemoryArea(area: string, address: number, count: number): Promise<any[]> { }
  async writeMemoryArea(area: string, address: number, values: any[]): Promise<void> { }
  async setPLCMode(mode: string): Promise<void> { }
}
```

## Tool Response Format

All tools return a consistent format:

```json
{
  "success": true,
  "data": {
    "memory_area": "DM",
    "start_address": 1000,
    "values": [100, 250, 75],
    "data_type": "INT16"
  },
  "error": null,
  "meta": {
    "timestamp": "2025-11-28T20:12:00Z",
    "plc_host": "192.168.1.10:9600",
    "protocol": "tcp",
    "network": "0/1/0",
    "execution_time_ms": 18
  }
}
```

## Example Tool Calls

### Read Memory Area
```json
{
  "tool": "read_memory_area",
  "parameters": {
    "memory_area": "DM",
    "address": 1000,
    "count": 10
  }
}
```

### Write Memory Area
```json
{
  "tool": "write_memory_area",
  "parameters": {
    "memory_area": "DM",
    "address": 1000,
    "values": [100, 200, 300]
  }
}
```

### Read CIO (I/O)
```json
{
  "tool": "read_cio",
  "parameters": {
    "address": 0,
    "count": 16
  }
}
```

### Set PLC Mode
```json
{
  "tool": "set_plc_mode",
  "parameters": {
    "mode": "RUN"
  }
}
```

### Read Float32
```json
{
  "tool": "read_float32",
  "parameters": {
    "memory_area": "DM",
    "address": 2000
  }
}
```

### Using Memory Map (Alias)
```json
{
  "tool": "read_memory_by_alias",
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
- **Network Access**: TCP/UDP connectivity to Omron PLC

### Python Dependencies
```toml
dependencies = [
    "mcp[cli]>=1.6.0",
    "python-dotenv>=1.1.0",
]
```

### NPM Dependencies
```json
"dependencies": {
  "@modelcontextprotocol/sdk": "^1.2.0",
  "dotenv": "^16.4.5"
}
```

## Security Considerations

1. **Write Protection**: Default `FINS_WRITES_ENABLED=true` with option to disable
2. **Mode Changes**: `FINS_MODE_CHANGE_ENABLED=false` by default
3. **Program Operations**: `FINS_PROGRAM_OPS_ENABLED=false` by default
4. **Input Validation**: All tool inputs validated before FINS operations
5. **Network Isolation**: Recommend dedicated PLC network
6. **Audit Logging**: Optional logging of all write and control operations

## Testing Strategy

### Mock PLC Test Cases
1. **Memory Reading**: Read all memory area types
2. **Memory Writing**: Write various memory areas
3. **Bit Operations**: Set/reset/toggle bits
4. **PLC Control**: Mode changes, status reading
5. **Data Types**: All data type conversions
6. **Error Handling**: Invalid addresses, communication failures
7. **Memory Map System**: Alias resolution, read/write by alias

### Real Hardware Testing
- Test with Omron NJ series PLCs
- Test with NX series PLCs
- Test with CJ series PLCs
- Test with CS series PLCs
- Test with CP series PLCs
- Verify data integrity
- Performance testing (latency, throughput)
- Multi-PLC scenarios
- TCP and UDP protocols

## Performance Targets

- **Memory Read**: < 50ms
- **Memory Write**: < 75ms
- **Multiple Read**: < 100ms (10 areas)
- **Multiple Write**: < 150ms (10 areas)
- **Mode Change**: < 200ms
- **Status Read**: < 30ms

## Troubleshooting Guide

Common issues and solutions to document:

1. **Connection Failed**
   - Verify IP address and port (9600 for TCP)
   - Check network connectivity
   - Ensure PLC Ethernet unit is configured
   - Verify firewall settings

2. **No Response**
   - Check network/node/unit addresses
   - Verify PLC is powered and online
   - Check protocol (TCP vs UDP)
   - Ensure correct timeout settings

3. **Write Failed**
   - Check write protection settings
   - Verify PLC is in correct mode
   - Check memory area is writable
   - Review FINS_WRITES_ENABLED setting

4. **Invalid Memory**
   - Verify memory area is valid for PLC model
   - Check address range
   - Ensure memory exists in PLC
   - Review PLC memory configuration

5. **Data Type Mismatch**
   - Check word count for data type
   - Verify byte order (big-endian)
   - Ensure proper type conversion

## FINS Protocol Details

### Supported Protocols
- **FINS/TCP**: Ethernet TCP (port 9600)
- **FINS/UDP**: Ethernet UDP (port 9600)
- **FINS Serial**: RS-232C/422/485 (planned)

### Memory Areas
- **CIO**: I/O area (inputs/outputs)
- **WR**: Work area (temporary storage)
- **HR**: Holding area (retentive)
- **AR**: Auxiliary area (system flags)
- **DM**: Data Memory (general data storage)
- **EM**: Extended Memory (large data banks)
- **TIM**: Timer area
- **CNT**: Counter area

### Supported PLC Series
- **NJ Series**: NJ101, NJ301, NJ501
- **NX Series**: NX102, NX1P2, NX7
- **CJ Series**: CJ1, CJ2
- **CS Series**: CS1
- **CP Series**: CP1E, CP1H, CP1L

### Command Types
- **Memory Read/Write**: Read and write memory areas
- **Multiple Read/Write**: Batch operations
- **Bit Set/Reset**: Individual bit control
- **Status Read**: PLC status and diagnostics
- **Mode Change**: RUN/MONITOR/PROGRAM
- **Clock**: Read/write PLC clock
- **Program**: Read/write programs

## Future Enhancements

- [ ] FINS over serial (RS-232C/422/485)
- [ ] Advanced routing for multi-network
- [ ] Program debugging support
- [ ] Force set/reset operations
- [ ] Data tracing
- [ ] File memory operations
- [ ] Web UI for PLC visualization
- [ ] Integration with Sysmac Studio
- [ ] Multi-CPU support
- [ ] CompoBus/S integration

## Success Criteria

This project will be considered complete when:

1. ✅ Both Python and NPM servers are fully functional
2. ✅ All core tools are implemented and tested
3. ✅ Mock PLC provides realistic testing environment
4. ✅ Memory area read/write operations work reliably
5. ✅ PLC control operations function correctly
6. ✅ Data type conversions work properly
7. ✅ Comprehensive documentation is complete
8. ✅ Successfully tested with real Omron PLCs
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

- [FINS Communication Command Reference Manual](https://assets.omron.com/m/70172eb7aa0a8b26/original/FINS-Commands-Reference-Manual.pdf)
- [Omron SYSMAC PLCs Documentation](https://industrial.omron.us/en/products/catalogue/automation_systems/programmable_controllers)
- [FINS Protocol Specification](https://www.omron.com/)
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [MODBUS-Project Reference](../../MODBUS-Project/)

---

**Document Version**: 1.0  
**Created**: 2025-11-28  
**Last Updated**: 2025-11-28  
**Status**: Planning Phase
