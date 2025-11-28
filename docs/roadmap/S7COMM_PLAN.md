# Siemens S7 S7comm MCP Server - Implementation Plan

## Project Overview

This plan outlines the development of a **Model Context Protocol (MCP) server for Siemens S7 PLCs** using the S7comm protocol. The implementation will follow the proven architecture from the MODBUS-Project, enabling AI agents and MCP-compatible applications to communicate with Siemens S7 PLCs (S7-300, S7-400, S7-1200, S7-1500).

## Project Goals

- Create a production-ready MCP server for S7comm protocol
- Support both Python and NPM/TypeScript implementations
- Provide comprehensive tooling for reading/writing S7 data blocks, I/O, and system information
- Include a mock S7 server for testing and development
- Maintain consistency with the MODBUS-Project architecture and patterns
- Enable seamless AI agent integration with Siemens industrial systems

## Repository Structure

```
S7comm-Project/
├── .gitignore                    # Combined ignore patterns (Python, Node, IDE)
├── README.md                     # Main project documentation
├── s7comm-python/                # Python MCP server implementation
│   ├── .gitignore
│   ├── .python-version
│   ├── README.md
│   ├── pyproject.toml           # uv/pip configuration
│   ├── uv.lock
│   └── src/
│       └── s7comm_mcp/
│           ├── __init__.py
│           ├── cli.py           # Entry point (s7comm-mcp command)
│           ├── server.py        # MCP server implementation
│           ├── tools.py         # S7comm tool definitions
│           └── s7_client.py     # S7 protocol client wrapper
├── s7comm-npm/                  # NPM/TypeScript MCP server
│   ├── .gitignore
│   ├── README.md
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── mcp-config-example.json
│   └── src/
│       └── index.ts             # Main MCP server + tools
└── s7comm-mock-server/          # Mock S7 PLC for testing
    ├── .gitignore
    ├── README.md
    ├── pyproject.toml
    └── s7_mock_server.py        # Simulated S7 PLC
```

## Technology Stack

### Python Implementation (s7comm-python)
- **Python**: 3.10+
- **Package Manager**: uv (modern, fast dependency manager)
- **MCP SDK**: `mcp[cli]>=1.6.0`
- **S7 Protocol**: `python-snap7>=1.3` or `python-snap7-ng` (wrapper for Snap7 library)
- **Environment**: `python-dotenv>=1.1.0`
- **Build System**: hatchling

### NPM Implementation (s7comm-npm)
- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.6+
- **MCP SDK**: `@modelcontextprotocol/sdk@^1.2.0`
- **S7 Protocol**: `node-snap7@^1.1.0` or `nodes7@^0.3.16`
- **Environment**: `dotenv@^16.4.5`
- **Build**: TypeScript compiler

### Mock Server (s7comm-mock-server)
- **Python**: 3.10+
- **Framework**: Custom S7comm protocol implementation or `snap7-server`
- **Package Manager**: uv

## Core Features & Tools

### 1. Data Block (DB) Operations
- **read_db**: Read data from a data block
  - Parameters: db_number, start_offset, size, data_type, slave_id
  - Supports: single values, arrays, structs
- **write_db**: Write data to a data block
  - Parameters: db_number, start_offset, value, data_type, slave_id
- **read_db_typed**: Typed read with data conversion
  - Data types: BYTE, WORD, DWORD, INT, DINT, REAL, STRING, BOOL
  - Endianness support

### 2. I/O Operations
- **read_input**: Read process input (PI/I)
- **read_output**: Read process output (PQ/Q)
- **write_output**: Write process output (PQ/Q)
- **read_marker**: Read memory marker (M)
- **write_marker**: Write memory marker (M)

### 3. PLC System Information
- **read_plc_info**: Get PLC identification (CPU type, serial number, module info)
- **read_cpu_state**: Get PLC CPU state (RUN, STOP, ERROR)
- **set_cpu_state**: Change CPU state (START, STOP)
- **read_system_time**: Get PLC system clock

### 4. Advanced Operations
- **read_multiple_vars**: Batch read multiple variables
- **write_multiple_vars**: Batch write multiple variables
- **read_szl**: Read System Status List (diagnostic data)

### 5. Tag Map System
- **list_tags**: List all configured tags
- **read_tag**: Read by tag name
- **write_tag**: Write by tag name
- Tag configuration file format (JSON):
```json
{
  "MotorSpeed": {
    "area": "db",
    "db_number": 1,
    "offset": 0,
    "data_type": "REAL",
    "description": "Motor speed in RPM"
  },
  "StartButton": {
    "area": "input",
    "byte": 0,
    "bit": 0,
    "data_type": "BOOL",
    "description": "Start button input"
  }
}
```

### 6. Health & Diagnostics
- **ping**: Connection health check and configuration report
- **get_connection_status**: Detailed connection status

## Environment Variables

```bash
# Connection Settings
S7_HOST=192.168.0.1              # PLC IP address (default: 127.0.0.1)
S7_PORT=102                       # S7comm port (default: 102)
S7_RACK=0                         # PLC rack number (default: 0)
S7_SLOT=2                         # PLC slot number (default: 2 for S7-1200/1500, 0 for S7-300/400)
S7_CONNECTION_TYPE=PG             # Connection type: PG | OP | S7_BASIC (default: PG)

# Protocol Settings
S7_TIMEOUT=5                      # Connection timeout in seconds (default: 5)
S7_MAX_RETRIES=3                  # Retry attempts (default: 3)
S7_RETRY_BACKOFF_BASE=0.5         # Backoff base in seconds (default: 0.5)

# Security Settings
S7_WRITES_ENABLED=true            # Allow write operations (default: true)
S7_SYSTEM_CMDS_ENABLED=false      # Allow system commands like CPU stop/start (default: false)

# Tag System
TAG_MAP_FILE=/path/to/tags.json   # Optional tag configuration file

# Debugging
S7_DEBUG=false                    # Enable debug logging (default: false)
```

## Implementation Phases

### Phase 1: Project Setup & Foundation ✅
- [ ] Create directory structure
- [ ] Set up .gitignore files (Python, Node, IDE files)
- [ ] Initialize Python project with uv
  - [ ] Create pyproject.toml
  - [ ] Set Python version (.python-version file)
  - [ ] Configure dependencies (snap7, mcp, dotenv)
- [ ] Initialize NPM project
  - [ ] Create package.json with bin entry
  - [ ] Configure TypeScript (tsconfig.json)
  - [ ] Add dependencies (MCP SDK, node-snap7/nodes7)
- [ ] Create main README.md

### Phase 2: Python MCP Server (s7comm-python)
- [ ] Core infrastructure
  - [ ] Set up MCP server scaffold (server.py)
  - [ ] Create S7 client wrapper (s7_client.py)
  - [ ] Implement connection management with retries
  - [ ] Add environment variable configuration
  - [ ] Create CLI entry point (cli.py)
- [ ] Basic tools implementation
  - [ ] read_db tool
  - [ ] write_db tool
  - [ ] read_input tool
  - [ ] read_output tool
  - [ ] write_output tool
- [ ] Advanced tools
  - [ ] read_db_typed with data type conversion
  - [ ] read_plc_info tool
  - [ ] read_cpu_state tool
  - [ ] set_cpu_state tool (with safety checks)
  - [ ] read_multiple_vars (batch operations)
- [ ] Tag system
  - [ ] Tag file parser (JSON)
  - [ ] list_tags tool
  - [ ] read_tag tool
  - [ ] write_tag tool
- [ ] Health & diagnostics
  - [ ] ping tool
  - [ ] get_connection_status tool
- [ ] Error handling & validation
  - [ ] Unified response format: `{success, data, error, meta}`
  - [ ] Input validation for all tools
  - [ ] Comprehensive error messages
- [ ] Documentation
  - [ ] README.md with installation, configuration, examples
  - [ ] Tool documentation with schemas
  - [ ] MCP client configuration examples

### Phase 3: NPM/TypeScript MCP Server (s7comm-npm)
- [ ] Port Python implementation to TypeScript
  - [ ] MCP server setup
  - [ ] S7 client integration (nodes7 or node-snap7)
  - [ ] Connection management
  - [ ] Environment configuration
- [ ] Implement all tools (matching Python API)
  - [ ] Data block operations
  - [ ] I/O operations
  - [ ] PLC info tools
  - [ ] Tag system
  - [ ] Health tools
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

### Phase 4: Mock S7 Server (s7comm-mock-server)
- [ ] Server implementation
  - [ ] Basic S7comm protocol server (using snap7 server or custom)
  - [ ] Simulate multiple data blocks
  - [ ] Simulate I/O areas (inputs, outputs, markers)
  - [ ] Configurable PLC type (S7-300, S7-1200, S7-1500)
- [ ] Test data
  - [ ] Pre-populated data blocks with sample data
  - [ ] Various data types (INT, DINT, REAL, BOOL, STRING)
  - [ ] Realistic industrial scenarios (motor control, sensors, alarms)
- [ ] Features
  - [ ] Configurable on address/port (default: 0.0.0.0:1102)
  - [ ] Console logging for read/write operations
  - [ ] CLI controls for changing values
  - [ ] Auto-updating values (simulated sensor data)
- [ ] Documentation
  - [ ] README.md with register/memory map
  - [ ] Usage examples
  - [ ] Integration testing guide

### Phase 5: Testing & Integration
- [ ] Unit tests
  - [ ] Python tool tests
  - [ ] TypeScript tool tests
  - [ ] Mock server tests
- [ ] Integration tests
  - [ ] Python MCP server ↔ Mock server
  - [ ] NPM MCP server ↔ Mock server
  - [ ] Tool output consistency between Python/NPM
- [ ] Real hardware testing
  - [ ] Test with actual S7-1200/1500 PLC
  - [ ] Test with S7-300/400 PLC
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
  - [ ] Feature comparison with MODBUS-Project
- [ ] Individual component READMEs
  - [ ] Complete API documentation
  - [ ] Environment variable reference
  - [ ] Troubleshooting guides
  - [ ] Example use cases
- [ ] MCP configuration examples
  - [ ] Claude Desktop configs (Python & NPM)
  - [ ] Other MCP client examples
- [ ] Tag map examples
  - [ ] Sample tag files for common scenarios
  - [ ] Tag best practices
- [ ] Video/GIF demonstrations
  - [ ] Setup and first run
  - [ ] Common operations
  - [ ] AI agent interaction examples

## Code Structure Details

### Python Server Architecture

```python
# src/s7comm_mcp/server.py
class S7CommMCPServer:
    def __init__(self):
        self.client = S7Client()
        self.tag_map = TagMap()
        
    async def run(self):
        # Initialize MCP server
        # Register all tools
        # Start stdio transport

# src/s7comm_mcp/s7_client.py
class S7Client:
    def __init__(self, host, rack, slot, ...):
        self.snap7_client = snap7.client.Client()
        
    def connect(self):
        # Connection with retries
        
    def read_db(self, db_number, start, size):
        # Read data block
        
    def write_db(self, db_number, start, data):
        # Write data block
```

### NPM Server Architecture

```typescript
// src/index.ts
class S7CommMCPServer {
  private client: S7Client;
  private tagMap: TagMap;
  
  async run() {
    // Initialize MCP server
    // Register tools
    // Start stdio transport
  }
}

// S7 client wrapper
class S7Client {
  constructor(host, rack, slot, ...) {
    // Initialize nodes7 or node-snap7
  }
  
  connect(): Promise<void> { }
  readDB(dbNumber, start, size): Promise<Buffer> { }
  writeDB(dbNumber, start, data): Promise<void> { }
}
```

## Tool Response Format

All tools return a consistent format:

```json
{
  "success": true,
  "data": {
    "value": 42.5,
    "raw_bytes": "0x42 0x2A 0x00 0x00",
    "data_type": "REAL"
  },
  "error": null,
  "meta": {
    "timestamp": "2025-11-28T18:12:28Z",
    "connection": "192.168.0.1:102",
    "rack": 0,
    "slot": 2,
    "execution_time_ms": 45
  }
}
```

## Example Tool Calls

### Read Data Block
```json
{
  "tool": "read_db",
  "parameters": {
    "db_number": 1,
    "start_offset": 0,
    "size": 4,
    "data_type": "REAL"
  }
}
```

### Write Data Block
```json
{
  "tool": "write_db",
  "parameters": {
    "db_number": 1,
    "start_offset": 10,
    "value": 75.5,
    "data_type": "REAL"
  }
}
```

### Read Multiple Variables
```json
{
  "tool": "read_multiple_vars",
  "parameters": {
    "variables": [
      {"area": "db", "db_number": 1, "offset": 0, "data_type": "REAL"},
      {"area": "input", "byte": 0, "bit": 0, "data_type": "BOOL"},
      {"area": "output", "byte": 2, "bit": 1, "data_type": "BOOL"}
    ]
  }
}
```

### Read PLC Information
```json
{
  "tool": "read_plc_info",
  "parameters": {}
}
```

### Using Tag Map
```json
{
  "tool": "read_tag",
  "parameters": {
    "name": "MotorSpeed"
  }
}
```

## Dependencies & Requirements

### System Requirements
- **Snap7 Library**: Must be installed on the system
  - Linux: `sudo apt-get install libsnap7-1 libsnap7-dev`
  - macOS: `brew install snap7`
  - Windows: Download from Snap7 website
- **Python**: 3.10 or higher
- **Node.js**: 18 or higher (for NPM version)
- **uv**: For Python dependency management

### Python Dependencies
```toml
dependencies = [
    "mcp[cli]>=1.6.0",
    "python-snap7>=1.3",
    "python-dotenv>=1.1.0",
]
```

### NPM Dependencies
```json
"dependencies": {
  "@modelcontextprotocol/sdk": "^1.2.0",
  "dotenv": "^16.4.5",
  "nodes7": "^0.3.16"
}
```

## Security Considerations

1. **Write Protection**: Default `S7_WRITES_ENABLED=true` with option to disable
2. **System Commands**: `S7_SYSTEM_CMDS_ENABLED=false` by default (CPU start/stop)
3. **Input Validation**: All tool inputs validated before S7 operations
4. **Connection Security**: Support for encrypted connections (if available in protocol)
5. **Audit Logging**: Optional logging of all write operations

## Testing Strategy

### Mock Server Test Cases
1. **Connection Tests**: Connect, disconnect, reconnect with retries
2. **Data Block Operations**: Read/write various data types
3. **I/O Operations**: Read inputs, write outputs
4. **Batch Operations**: Multiple variable read/write
5. **Error Handling**: Invalid addresses, type mismatches, connection failures
6. **Tag System**: Tag resolution, read/write by tag name

### Real PLC Testing
- Test with multiple PLC models (S7-300, S7-1200, S7-1500)
- Verify data integrity across all data types
- Performance testing (latency, throughput)
- Concurrent operation testing

## Performance Targets

- **Connection Establishment**: < 1 second
- **Single Read Operation**: < 50ms
- **Single Write Operation**: < 100ms
- **Batch Operations (10 vars)**: < 200ms
- **Tag Lookup**: < 5ms (in-memory)

## Troubleshooting Guide

Common issues and solutions to document:

1. **Connection Failed**
   - Verify IP address, rack, slot parameters
   - Check firewall settings (port 102)
   - Ensure PLC allows external connections
   - Verify Snap7 library installation

2. **Access Denied**
   - Check PLC protection settings
   - Verify connection type (PG vs OP)
   - Ensure writes are enabled

3. **Invalid Data**
   - Verify DB exists and has sufficient size
   - Check data type matches
   - Validate offset is within bounds

4. **Snap7 Not Found**
   - Install system library (see installation guide)
  - Check library path configuration

## Future Enhancements

- [ ] Support for S7 protocol optimizations (PDU size negotiation)
- [ ] TLS/encrypted connection support
- [ ] Extended diagnostics (alarm reading, event logs)
- [ ] OPC UA gateway mode
- [ ] Web UI for testing and monitoring
- [ ] Symbol table import (from TIA Portal)
- [ ] Data logging and trending
- [ ] Multi-PLC orchestration tools

## Success Criteria

This project will be considered complete when:

1. ✅ Both Python and NPM servers are fully functional
2. ✅ All core tools are implemented and tested
3. ✅ Mock server provides realistic testing environment
4. ✅ Comprehensive documentation is complete
5. ✅ Successfully tested with real S7 PLCs
6. ✅ Claude Desktop integration works seamlessly
7. ✅ Performance targets are met
8. ✅ Security best practices are implemented

## Timeline Estimate

- **Phase 1** (Setup): 1-2 days
- **Phase 2** (Python Server): 5-7 days
- **Phase 3** (NPM Server): 3-4 days
- **Phase 4** (Mock Server): 2-3 days
- **Phase 5** (Testing): 3-4 days
- **Phase 6** (Documentation): 2-3 days

**Total Estimated Time**: 16-23 days

## References

- [Snap7 Documentation](http://snap7.sourceforge.net/)
- [S7comm Protocol Specification](https://wiki.wireshark.org/S7comm)
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [MODBUS-Project Reference](../../MODBUS-Project/)
- [Siemens S7 Communication](https://support.industry.siemens.com/)

---

**Document Version**: 1.0  
**Created**: 2025-11-28  
**Last Updated**: 2025-11-28  
**Status**: Planning Phase
