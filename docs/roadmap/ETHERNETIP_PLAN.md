# EtherNet/IP MCP Server - Implementation Plan
## Rockwell Automation / Allen-Bradley Protocol

## Project Overview

This plan outlines the development of a **Model Context Protocol (MCP) server for EtherNet/IP** used by Rockwell Automation and Allen-Bradley PLCs. The implementation will follow the proven architecture from the MODBUS-Project, enabling AI agents and MCP-compatible applications to communicate with Allen-Bradley PLCs (ControlLogix, CompactLogix, MicroLogix, SLC 500).

## Project Goals

- Create a production-ready MCP server for EtherNet/IP protocol
- Support both Python and NPM/TypeScript implementations
- Provide comprehensive tooling for reading/writing tags, arrays, and structures
- Include a mock EtherNet/IP server for testing and development
- Maintain consistency with the MODBUS-Project architecture and patterns
- Enable seamless AI agent integration with Rockwell Automation industrial systems

## Repository Structure

```
EtherNetIP-Project/
├── .gitignore                    # Combined ignore patterns (Python, Node, IDE)
├── README.md                     # Main project documentation
├── ethernetip-python/            # Python MCP server implementation
│   ├── .gitignore
│   ├── .python-version
│   ├── README.md
│   ├── pyproject.toml           # uv/pip configuration
│   ├── uv.lock
│   └── src/
│       └── ethernetip_mcp/
│           ├── __init__.py
│           ├── cli.py           # Entry point (ethernetip-mcp command)
│           ├── server.py        # MCP server implementation
│           ├── tools.py         # EtherNet/IP tool definitions
│           └── eip_client.py    # EtherNet/IP protocol client wrapper
├── ethernetip-npm/              # NPM/TypeScript MCP server
│   ├── .gitignore
│   ├── README.md
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── mcp-config-example.json
│   └── src/
│       └── index.ts             # Main MCP server + tools
└── ethernetip-mock-server/      # Mock Allen-Bradley PLC for testing
    ├── .gitignore
    ├── README.md
    ├── pyproject.toml
    └── eip_mock_server.py       # Simulated Allen-Bradley PLC
```

## Technology Stack

### Python Implementation (ethernetip-python)
- **Python**: 3.10+
- **Package Manager**: uv (modern, fast dependency manager)
- **MCP SDK**: `mcp[cli]>=1.6.0`
- **EtherNet/IP Protocol**: `pycomm3>=1.2.14` (pure Python CIP/EtherNet/IP library)
- **Environment**: `python-dotenv>=1.1.0`
- **Build System**: hatchling

### NPM Implementation (ethernetip-npm)
- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.6+
- **MCP SDK**: `@modelcontextprotocol/sdk@^1.2.0`
- **EtherNet/IP Protocol**: `ethernet-ip@^1.4.0` or `st-ethernet-ip@^1.0.0`
- **Environment**: `dotenv@^16.4.5`
- **Build**: TypeScript compiler

### Mock Server (ethernetip-mock-server)
- **Python**: 3.10+
- **Framework**: Custom EtherNet/IP/CIP protocol implementation
- **Package Manager**: uv

## Core Features & Tools

### 1. Tag Operations
- **read_tag**: Read a single tag value
  - Parameters: tag_name, elements (for arrays)
  - Supports: atomic types, strings, arrays, structures
- **write_tag**: Write a single tag value
  - Parameters: tag_name, value, elements (for arrays)
- **read_tag_typed**: Typed read with automatic data conversion
  - Data types: BOOL, SINT, INT, DINT, LINT, REAL, STRING, DWORD, etc.

### 2. Array & Structure Operations
- **read_array**: Read tag array (optimized for large arrays)
- **write_array**: Write tag array
- **read_string**: Read STRING tag
- **write_string**: Write STRING tag
- **read_structure**: Read UDT (User Defined Type)
- **write_structure**: Write UDT

### 3. Tag Discovery
- **get_tag_list**: Enumerate all tags in the PLC
  - Returns: tag names, data types, dimensions
- **get_program_tag_list**: Get tags from specific program
- **get_udt_definition**: Get User Defined Type structure definition

### 4. PLC System Information
- **get_plc_info**: Get PLC identification (name, type, serial number, firmware)
- **get_plc_name**: Get controller name
- **get_plc_time**: Get PLC system clock
- **set_plc_time**: Set PLC system clock

### 5. Advanced Operations
- **read_multiple_tags**: Batch read multiple tags in single request
- **write_multiple_tags**: Batch write multiple tags
- **get_module_info**: Get information about I/O modules in chassis

### 6. Tag Map System
- **list_tags**: List all configured tags from map
- **read_tag_by_alias**: Read by alias name
- **write_tag_by_alias**: Write by alias name
- Tag configuration file format (JSON):
```json
{
  "MotorSpeed": {
    "tag": "Program:MainProgram.Motor1_Speed",
    "data_type": "REAL",
    "description": "Motor 1 speed in RPM",
    "scaling": {
      "raw_min": 0,
      "raw_max": 1800,
      "eng_min": 0,
      "eng_max": 100
    }
  },
  "ConveyorRunning": {
    "tag": "Program:MainProgram.Conveyor_Status.Running",
    "data_type": "BOOL",
    "description": "Conveyor running status"
  },
  "TankLevels": {
    "tag": "Program:MainProgram.Tank_Levels",
    "data_type": "REAL[10]",
    "description": "Array of 10 tank level values"
  }
}
```

### 7. Health & Diagnostics
- **ping**: Connection health check and configuration report
- **get_connection_status**: Detailed connection status and session info
- **forward_open**: Explicitly open connection
- **forward_close**: Explicitly close connection

## Environment Variables

```bash
# Connection Settings
ENIP_HOST=192.168.1.10           # PLC IP address (default: 127.0.0.1)
ENIP_PORT=44818                  # EtherNet/IP port (default: 44818)
ENIP_SLOT=0                      # PLC slot in chassis (default: 0 for ControlLogix, 2 for CompactLogix)

# CIP Path Settings (for routing through multiple chassis/networks)
ENIP_PATH=1,0                    # CIP routing path (default: determined by slot)
ENIP_MICRO800=false              # Set true for Micro800 series PLCs

# Protocol Settings
ENIP_TIMEOUT=10                  # Connection timeout in seconds (default: 10)
ENIP_MAX_RETRIES=3               # Retry attempts (default: 3)
ENIP_RETRY_BACKOFF_BASE=0.5      # Backoff base in seconds (default: 0.5)

# Performance Settings
ENIP_INIT_INFO=true              # Fetch tag list on connect (default: true)
ENIP_CACHE_TAG_LIST=true         # Cache tag list (default: true)
ENIP_CACHE_TIMEOUT=3600          # Tag cache timeout in seconds (default: 3600)

# Security Settings
ENIP_WRITES_ENABLED=true         # Allow write operations (default: true)
ENIP_SYSTEM_CMDS_ENABLED=false   # Allow system commands like set time (default: false)

# Tag System
TAG_MAP_FILE=/path/to/tags.json  # Optional tag configuration file

# Debugging
ENIP_DEBUG=false                 # Enable debug logging (default: false)
ENIP_LOG_CIP_PACKETS=false       # Log raw CIP packets (default: false)
```

## Implementation Phases

### Phase 1: Project Setup & Foundation ✅
- [ ] Create directory structure
- [ ] Set up .gitignore files (Python, Node, IDE files)
- [ ] Initialize Python project with uv
  - [ ] Create pyproject.toml
  - [ ] Set Python version (.python-version file)
  - [ ] Configure dependencies (pycomm3, mcp, dotenv)
- [ ] Initialize NPM project
  - [ ] Create package.json with bin entry
  - [ ] Configure TypeScript (tsconfig.json)
  - [ ] Add dependencies (MCP SDK, ethernet-ip)
- [ ] Create main README.md

### Phase 2: Python MCP Server (ethernetip-python)
- [ ] Core infrastructure
  - [ ] Set up MCP server scaffold (server.py)
  - [ ] Create EtherNet/IP client wrapper (eip_client.py)
  - [ ] Implement connection management with retries
  - [ ] Add environment variable configuration
  - [ ] Create CLI entry point (cli.py)
- [ ] Basic tools implementation
  - [ ] read_tag tool
  - [ ] write_tag tool
  - [ ] read_array tool
  - [ ] write_array tool
  - [ ] read_string tool
  - [ ] write_string tool
- [ ] Tag discovery tools
  - [ ] get_tag_list tool
  - [ ] get_program_tag_list tool
  - [ ] get_udt_definition tool
- [ ] Advanced tools
  - [ ] read_tag_typed with data type conversion
  - [ ] read_structure / write_structure
  - [ ] get_plc_info tool
  - [ ] get_plc_time / set_plc_time tools
  - [ ] read_multiple_tags (batch operations)
  - [ ] write_multiple_tags
  - [ ] get_module_info tool
- [ ] Tag map system
  - [ ] Tag file parser (JSON)
  - [ ] list_tags tool
  - [ ] read_tag_by_alias tool
  - [ ] write_tag_by_alias tool
  - [ ] Scaling/engineering units support
- [ ] Health & diagnostics
  - [ ] ping tool
  - [ ] get_connection_status tool
  - [ ] forward_open / forward_close tools
- [ ] Error handling & validation
  - [ ] Unified response format: `{success, data, error, meta}`
  - [ ] Input validation for all tools
  - [ ] CIP status code translation
  - [ ] Comprehensive error messages
- [ ] Documentation
  - [ ] README.md with installation, configuration, examples
  - [ ] Tool documentation with schemas
  - [ ] MCP client configuration examples

### Phase 3: NPM/TypeScript MCP Server (ethernetip-npm)
- [ ] Port Python implementation to TypeScript
  - [ ] MCP server setup
  - [ ] EtherNet/IP client integration (ethernet-ip library)
  - [ ] Connection management
  - [ ] Environment configuration
- [ ] Implement all tools (matching Python API)
  - [ ] Tag read/write operations
  - [ ] Array and structure operations
  - [ ] Tag discovery tools
  - [ ] PLC info tools
  - [ ] Tag map system
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

### Phase 4: Mock EtherNet/IP Server (ethernetip-mock-server)
- [ ] Server implementation
  - [ ] Basic CIP/EtherNet/IP protocol server
  - [ ] Simulate tag database
  - [ ] Support various data types (BOOL, INT, DINT, REAL, STRING, arrays)
  - [ ] Configurable PLC type (ControlLogix, CompactLogix, MicroLogix)
- [ ] Test data
  - [ ] Pre-populated tags with sample data
  - [ ] Program-scoped and controller-scoped tags
  - [ ] User Defined Types (UDTs)
  - [ ] Realistic industrial scenarios (motor control, sensors, alarms)
- [ ] Features
  - [ ] Configurable on address/port (default: 0.0.0.0:44818)
  - [ ] Console logging for read/write operations
  - [ ] CLI controls for changing values
  - [ ] Auto-updating values (simulated sensor data)
  - [ ] Tag list discovery support
- [ ] Documentation
  - [ ] README.md with tag map
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
  - [ ] Test with ControlLogix PLC
  - [ ] Test with CompactLogix PLC
  - [ ] Test with MicroLogix PLC (if applicable)
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
  - [ ] Supported PLC models
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
  - [ ] Tag naming conventions
  - [ ] Scaling and engineering units
  - [ ] Tag best practices
- [ ] Video/GIF demonstrations
  - [ ] Setup and first run
  - [ ] Common operations
  - [ ] AI agent interaction examples

## Code Structure Details

### Python Server Architecture

```python
# src/ethernetip_mcp/server.py
class EtherNetIPMCPServer:
    def __init__(self):
        self.client = EIPClient()
        self.tag_map = TagMap()
        
    async def run(self):
        # Initialize MCP server
        # Register all tools
        # Start stdio transport

# src/ethernetip_mcp/eip_client.py
from pycomm3 import LogixDriver

class EIPClient:
    def __init__(self, host, slot=0, ...):
        self.driver = LogixDriver(host, slot=slot)
        
    def connect(self):
        # Connection with retries
        
    def read_tag(self, tag_name, count=1):
        # Read tag value
        
    def write_tag(self, tag_name, value, data_type=None):
        # Write tag value
        
    def get_tag_list(self, program=None):
        # Get all tags
```

### NPM Server Architecture

```typescript
// src/index.ts
import { Controller } from 'ethernet-ip';

class EtherNetIPMCPServer {
  private controller: Controller;
  private tagMap: TagMap;
  
  async run() {
    // Initialize MCP server
    // Register tools
    // Start stdio transport
  }
}

// EtherNet/IP client wrapper
class EIPClient {
  private controller: Controller;
  
  constructor(host: string, slot: number = 0) {
    this.controller = new Controller();
  }
  
  async connect(): Promise<void> { }
  async readTag(tagName: string): Promise<any> { }
  async writeTag(tagName: string, value: any): Promise<void> { }
  async getTagList(): Promise<TagInfo[]> { }
}
```

## Tool Response Format

All tools return a consistent format:

```json
{
  "success": true,
  "data": {
    "tag_name": "Program:MainProgram.Motor1_Speed",
    "value": 1425.5,
    "data_type": "REAL",
    "timestamp": "2025-11-28T18:20:00Z"
  },
  "error": null,
  "meta": {
    "timestamp": "2025-11-28T18:20:02Z",
    "connection": "192.168.1.10:44818",
    "slot": 0,
    "execution_time_ms": 32,
    "cip_status": "0x00 - Success"
  }
}
```

## Example Tool Calls

### Read Tag
```json
{
  "tool": "read_tag",
  "parameters": {
    "tag_name": "Program:MainProgram.Motor1_Speed"
  }
}
```

### Write Tag
```json
{
  "tool": "write_tag",
  "parameters": {
    "tag_name": "Program:MainProgram.SetPoint",
    "value": 75.5,
    "data_type": "REAL"
  }
}
```

### Read Array
```json
{
  "tool": "read_array",
  "parameters": {
    "tag_name": "Program:MainProgram.Tank_Levels",
    "elements": 10
  }
}
```

### Read Multiple Tags
```json
{
  "tool": "read_multiple_tags",
  "parameters": {
    "tags": [
      "Program:MainProgram.Motor1_Speed",
      "Program:MainProgram.Conveyor_Status.Running",
      "Program:MainProgram.Temperature[0]"
    ]
  }
}
```

### Get Tag List
```json
{
  "tool": "get_tag_list",
  "parameters": {
    "program": "MainProgram"
  }
}
```

### Get PLC Information
```json
{
  "tool": "get_plc_info",
  "parameters": {}
}
```

### Using Tag Map (Alias)
```json
{
  "tool": "read_tag_by_alias",
  "parameters": {
    "alias": "MotorSpeed"
  }
}
```

## Dependencies & Requirements

### System Requirements
- **Python**: 3.10 or higher
- **Node.js**: 18 or higher (for NPM version)
- **uv**: For Python dependency management
- **Network Access**: PLC must be reachable on network

### Python Dependencies
```toml
dependencies = [
    "mcp[cli]>=1.6.0",
    "pycomm3>=1.2.14",
    "python-dotenv>=1.1.0",
]
```

### NPM Dependencies
```json
"dependencies": {
  "@modelcontextprotocol/sdk": "^1.2.0",
  "dotenv": "^16.4.5",
  "ethernet-ip": "^1.4.0"
}
```

## Security Considerations

1. **Write Protection**: Default `ENIP_WRITES_ENABLED=true` with option to disable
2. **System Commands**: `ENIP_SYSTEM_CMDS_ENABLED=false` by default (set PLC time, etc.)
3. **Input Validation**: All tool inputs validated before EtherNet/IP operations
4. **Tag Access Control**: Respect PLC security settings
5. **Audit Logging**: Optional logging of all write operations
6. **Network Security**: Recommend VLANs and firewall rules for production

## Testing Strategy

### Mock Server Test Cases
1. **Connection Tests**: Connect, disconnect, reconnect with retries
2. **Tag Operations**: Read/write various data types and structures
3. **Array Operations**: Read/write arrays of different sizes
4. **String Operations**: Read/write STRING tags
5. **Batch Operations**: Multiple tag read/write
6. **Tag Discovery**: Get tag list, UDT definitions
7. **Error Handling**: Invalid tags, type mismatches, connection failures
8. **Tag Map System**: Alias resolution, read/write by alias

### Real PLC Testing
- Test with ControlLogix, CompactLogix, MicroLogix PLCs
- Verify data integrity across all data types
- Test with UDTs (User Defined Types)
- Performance testing (latency, throughput)
- Large array handling
- Concurrent operation testing

## Performance Targets

- **Connection Establishment**: < 2 seconds
- **Single Tag Read**: < 30ms
- **Single Tag Write**: < 50ms
- **Batch Read (10 tags)**: < 100ms
- **Batch Write (10 tags)**: < 150ms
- **Tag List Discovery**: < 500ms (depends on tag count)
- **Tag Lookup (from cache)**: < 1ms

## Troubleshooting Guide

Common issues and solutions to document:

1. **Connection Failed**
   - Verify IP address and PLC is online
   - Check slot number (0 for ControlLogix, 2 for CompactLogix)
   - Verify firewall allows port 44818
   - Ensure PLC has available connection slots

2. **Tag Not Found**
   - Verify tag name spelling (case-sensitive)
   - Check program scope (Program:ProgramName.TagName)
   - Use get_tag_list to enumerate available tags
   - Verify tag exists in PLC project

3. **Access Denied / CIP Error**
   - Check PLC security settings
   - Verify connection type supports operation
   - Ensure writes are enabled
   - Check PLC mode (RUN vs PROGRAM)

4. **Type Mismatch**
   - Verify data type matches tag definition
   - Use get_tag_list to check actual data type
   - For arrays, specify correct element count

5. **Performance Issues**
   - Use batch operations for multiple tags
   - Enable tag list caching
   - Consider PLC CPU load
   - Check network latency

## PLC Compatibility

### Tested/Supported Models
- **ControlLogix** (5500 series)
- **CompactLogix** (5300, 5400 series)
- **MicroLogix 1100, 1400** (limited support)
- **CompactLogix 5480** (with embedded EtherNet/IP)
- **Micro800** (with special configuration)

### Known Limitations
- **SLC 500**: Requires PCCC protocol (not EtherNet/IP)
- **PLC-5**: Requires PCCC protocol (not EtherNet/IP)
- **Micro800**: Requires different CIP path configuration

## Future Enhancements

- [ ] Support for PCCC protocol (SLC 500, PLC-5)
- [ ] CIP routing through multiple chassis/networks
- [ ] CIP Safety support
- [ ] Produced/Consumed tag monitoring
- [ ] Alarm/event log reading
- [ ] Upload/download tag values in bulk
- [ ] Tag trending and data logging
- [ ] Web UI for testing and monitoring
- [ ] L5X project file import (tag definitions)
- [ ] Multi-PLC orchestration tools
- [ ] CIP motion control extensions

## Success Criteria

This project will be considered complete when:

1. ✅ Both Python and NPM servers are fully functional
2. ✅ All core tools are implemented and tested
3. ✅ Mock server provides realistic testing environment
4. ✅ Comprehensive documentation is complete
5. ✅ Successfully tested with real Allen-Bradley PLCs
6. ✅ Claude Desktop integration works seamlessly
7. ✅ Performance targets are met
8. ✅ Security best practices are implemented
9. ✅ Tag discovery and caching work efficiently
10. ✅ Support for major PLC models validated

## Timeline Estimate

- **Phase 1** (Setup): 1-2 days
- **Phase 2** (Python Server): 6-8 days
- **Phase 3** (NPM Server): 3-5 days
- **Phase 4** (Mock Server): 3-4 days
- **Phase 5** (Testing): 4-5 days
- **Phase 6** (Documentation): 2-3 days

**Total Estimated Time**: 19-27 days

## References

- [pycomm3 Documentation](https://docs.pycomm3.dev/)
- [ethernet-ip NPM Package](https://www.npmjs.com/package/ethernet-ip)
- [EtherNet/IP Specification](https://www.odva.org/)
- [CIP Protocol Specification](https://www.odva.org/technology-standards/key-technologies/common-industrial-protocol-cip/)
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [MODBUS-Project Reference](../../MODBUS-Project/)
- [Rockwell Automation Documentation](https://literature.rockwellautomation.com/)

---

**Document Version**: 1.0  
**Created**: 2025-11-28  
**Last Updated**: 2025-11-28  
**Status**: Planning Phase
