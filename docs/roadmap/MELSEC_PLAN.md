# MELSEC MC Protocol MCP Server - Implementation Plan
## Mitsubishi PLC Communication Protocol

## Project Overview

This plan outlines the development of a **Model Context Protocol (MCP) server for Mitsubishi MELSEC MC Protocol** - Mitsubishi's communication protocol for MELSEC series PLCs (iQ-F, iQ-R, Q, L series). The implementation will follow the proven architecture from the MODBUS-Project, enabling AI agents and MCP-compatible applications to communicate with Mitsubishi PLCs for manufacturing automation and control.

## Project Goals

- Create a production-ready MCP server for MELSEC MC Protocol
- Support both Python and NPM/TypeScript implementations
- Provide comprehensive tooling for device memory operations, batch operations, and monitoring
- Include a mock MELSEC PLC for testing and development
- Maintain consistency with the MODBUS-Project architecture and patterns
- Enable seamless AI agent integration with Mitsubishi automation systems
- Support MC Protocol 3E and 4E frame formats (ASCII and Binary)

## Repository Structure

```
MELSEC-Project/
├── .gitignore                    # Combined ignore patterns (Python, Node, IDE)
├── README.md                     # Main project documentation
├── melsec-python/                # Python MCP server implementation
│   ├── .gitignore
│   ├── .python-version
│   ├── README.md
│   ├── pyproject.toml           # uv/pip configuration
│   ├── uv.lock
│   └── src/
│       └── melsec_mcp/
│           ├── __init__.py
│           ├── cli.py           # Entry point (melsec-mcp command)
│           ├── server.py        # MCP server implementation
│           ├── tools.py         # MC Protocol tool definitions
│           └── mc_client.py     # MC Protocol client wrapper
├── melsec-npm/                  # NPM/TypeScript MCP server
│   ├── .gitignore
│   ├── README.md
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── mcp-config-example.json
│   └── src/
│       └── index.ts             # Main MCP server + tools
└── melsec-mock-plc/             # Mock MELSEC PLC for testing
    ├── .gitignore
    ├── README.md
    ├── pyproject.toml
    └── melsec_mock_plc.py       # Simulated MELSEC PLC
```

## Technology Stack

### Python Implementation (melsec-python)
- **Python**: 3.10+
- **Package Manager**: uv (modern, fast dependency manager)
- **MCP SDK**: `mcp[cli]>=1.6.0`
- **MC Protocol**: `pymcprotocol>=0.1.0` or custom implementation
- **Environment**: `python-dotenv>=1.1.0`
- **Build System**: hatchling

### NPM Implementation (melsec-npm)
- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.6+
- **MCP SDK**: `@modelcontextprotocol/sdk@^1.2.0`
- **MC Protocol**: Custom implementation or available libraries
- **Environment**: `dotenv@^16.4.5`
- **Build**: TypeScript compiler

### Mock PLC (melsec-mock-plc)
- **Python**: 3.10+
- **Framework**: Custom MC Protocol server implementation
- **Package Manager**: uv

## Core Features & Tools

### 1. Device Memory Operations
- **read_device**: Read device memory (bit/word devices)
  - Parameters: device_type, start_address, count
  - Device types: X, Y, M, L, F, B, D, W, R, ZR, etc.
- **write_device**: Write device memory
  - Parameters: device_type, start_address, values
- **read_random**: Read random device addresses
- **write_random**: Write random device addresses

### 2. Bit Device Operations
- **read_bits**: Read multiple bit devices
  - Devices: X (Input), Y (Output), M (Internal relay), L (Latch relay), etc.
- **write_bits**: Write multiple bit devices
- **set_bit**: Set bit ON
- **reset_bit**: Set bit OFF

### 3. Word Device Operations
- **read_words**: Read multiple word devices
  - Devices: D (Data register), W (Link register), R (File register), etc.
- **write_words**: Write multiple word devices
- **read_dword**: Read double word (32-bit)
- **write_dword**: Write double word

### 4. Batch Operations
- **batch_read**: Batch read multiple device blocks
- **batch_write**: Batch write multiple device blocks
- **read_memory_block**: Read continuous memory block
- **write_memory_block**: Write continuous memory block

### 5. Remote Operations
- **remote_run**: Set PLC to RUN mode
- **remote_stop**: Set PLC to STOP mode
- **remote_pause**: Pause PLC execution
- **remote_reset**: Reset PLC
- **read_plc_status**: Read PLC operating status

### 6. Device Monitoring
- **monitor_device**: Start monitoring device changes
  - Parameters: device_type, start_address, count, interval
- **stop_monitor**: Stop device monitoring
- **get_monitor_data**: Get latest monitored data

### 7. File Operations
- **read_file**: Read file from PLC memory card
- **write_file**: Write file to PLC memory card
- **list_files**: List files on PLC
- **delete_file**: Delete file from PLC

### 8. Device Map System
- **list_devices**: List all configured devices from map
- **read_device_by_alias**: Read by alias name
- **write_device_by_alias**: Write by alias name
- Device configuration file format (JSON):
```json
{
  "ConveyorMotor": {
    "device_type": "M",
    "address": 100,
    "bit_count": 1,
    "description": "Conveyor motor run status",
    "tags": ["motor", "conveyor"]
  },
  "ProductCounter": {
    "device_type": "D",
    "address": 1000,
    "word_count": 1,
    "description": "Product count register",
    "data_type": "INT16"
  },
  "Temperature": {
    "device_type": "D",
    "address": 2000,
    "word_count": 2,
    "description": "Temperature sensor value",
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

### 10. Diagnostics & Health
- **ping**: Connection health check
- **get_cpu_info**: Get CPU type and version
- **get_error_code**: Read PLC error code
- **clear_error**: Clear PLC error
- **test_connection**: Test communication with PLC

## Environment Variables

```bash
# Connection Settings
MC_HOST=192.168.1.10             # PLC IP address (default: 192.168.1.10)
MC_PORT=5007                     # Port for MC Protocol 3E (default: 5007)
MC_PROTOCOL_TYPE=3E              # Protocol type: 3E or 4E (default: 3E)
MC_FRAME_TYPE=binary             # Frame type: binary or ascii (default: binary)

# Network Settings
MC_NETWORK=0                     # Network number (default: 0)
MC_STATION=255                   # Station number (default: 255 - own station)
MC_MODULE_IO=1023                # Module I/O number (default: 1023)
MC_MODULE_STATION=0              # Module station number (default: 0)

# Protocol Settings
MC_TIMEOUT=5000                  # Response timeout in milliseconds (default: 5000)
MC_MAX_RETRIES=3                 # Retry attempts (default: 3)
MC_RETRY_BACKOFF_BASE=0.5        # Backoff base in seconds (default: 0.5)

# PLC Settings
MC_PLC_TYPE=iQ-R                 # PLC type: iQ-R, iQ-F, Q, L (default: iQ-R)
MC_CPU_TIMER=250                 # CPU monitoring timer in ms (default: 250)

# Device Settings
MC_WORD_SIZE=2                   # Word size in bytes (default: 2)
MC_BIT_DEVICE_UNITS=16           # Number of bits per word device (default: 16)

# Security Settings
MC_WRITES_ENABLED=true           # Allow write operations (default: true)
MC_REMOTE_OPS_ENABLED=false      # Allow remote operations (default: false)

# Device Map
DEVICE_MAP_FILE=/path/to/devices.json  # Optional device configuration file

# Debugging
MC_DEBUG=false                   # Enable debug logging (default: false)
MC_LOG_FRAMES=false              # Log MC Protocol frames (default: false)
```

## Implementation Phases

### Phase 1: Project Setup & Foundation ✅
- [ ] Create directory structure
- [ ] Set up .gitignore files (Python, Node, IDE files)
- [ ] Initialize Python project with uv
  - [ ] Create pyproject.toml
  - [ ] Set Python version (.python-version file)
  - [ ] Configure dependencies (pymcprotocol, mcp, dotenv)
- [ ] Initialize NPM project
  - [ ] Create package.json with bin entry
  - [ ] Configure TypeScript (tsconfig.json)
  - [ ] Add dependencies (MCP SDK)
- [ ] Create main README.md

### Phase 2: Python MCP Server (melsec-python)
- [ ] Core infrastructure
  - [ ] Set up MCP server scaffold (server.py)
  - [ ] Create MC Protocol client wrapper (mc_client.py)
  - [ ] Implement MC Protocol 3E frame encoding/decoding
  - [ ] Implement MC Protocol 4E frame encoding/decoding
  - [ ] Add environment variable configuration
  - [ ] Create CLI entry point (cli.py)
- [ ] Device memory operations
  - [ ] read_device tool
  - [ ] write_device tool
  - [ ] read_random tool
  - [ ] write_random tool
- [ ] Bit device operations
  - [ ] read_bits tool
  - [ ] write_bits tool
  - [ ] set_bit tool
  - [ ] reset_bit tool
- [ ] Word device operations
  - [ ] read_words tool
  - [ ] write_words tool
  - [ ] read_dword tool
  - [ ] write_dword tool
- [ ] Batch operations
  - [ ] batch_read tool
  - [ ] batch_write tool
  - [ ] read_memory_block tool
  - [ ] write_memory_block tool
- [ ] Remote operations
  - [ ] remote_run tool
  - [ ] remote_stop tool
  - [ ] remote_pause tool
  - [ ] remote_reset tool
  - [ ] read_plc_status tool
- [ ] Device monitoring
  - [ ] monitor_device tool
  - [ ] stop_monitor tool
  - [ ] get_monitor_data tool
- [ ] File operations
  - [ ] read_file tool
  - [ ] write_file tool
  - [ ] list_files tool
  - [ ] delete_file tool
- [ ] Device map system
  - [ ] Device file parser (JSON)
  - [ ] list_devices tool
  - [ ] read_device_by_alias tool
  - [ ] write_device_by_alias tool
- [ ] Data type conversions
  - [ ] read_int16 tool
  - [ ] read_uint16 tool
  - [ ] read_int32 tool
  - [ ] read_uint32 tool
  - [ ] read_float32 tool
  - [ ] read_string tool
- [ ] Diagnostics & health
  - [ ] ping tool
  - [ ] get_cpu_info tool
  - [ ] get_error_code tool
  - [ ] clear_error tool
  - [ ] test_connection tool
- [ ] Error handling & validation
  - [ ] Unified response format: `{success, data, error, meta}`
  - [ ] Input validation for all tools
  - [ ] MC Protocol error code translation
  - [ ] Comprehensive error messages
- [ ] Documentation
  - [ ] README.md with installation, configuration, examples
  - [ ] Tool documentation with schemas
  - [ ] Device mapping guide
  - [ ] Device type reference
  - [ ] MCP client configuration examples

### Phase 3: NPM/TypeScript MCP Server (melsec-npm)
- [ ] Port Python implementation to TypeScript
  - [ ] MCP server setup
  - [ ] MC Protocol client implementation
  - [ ] Frame encoding/decoding (3E/4E)
  - [ ] Environment configuration
- [ ] Implement all tools (matching Python API)
  - [ ] Device memory operations
  - [ ] Bit device operations
  - [ ] Word device operations
  - [ ] Batch operations
  - [ ] Remote operations
  - [ ] Device monitoring
  - [ ] File operations
  - [ ] Device map system
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

### Phase 4: Mock MELSEC PLC (melsec-mock-plc)
- [ ] PLC implementation
  - [ ] MC Protocol server stack
  - [ ] 3E frame handler
  - [ ] 4E frame handler
  - [ ] Device memory simulation
- [ ] Device types
  - [ ] Bit devices (X, Y, M, L, F, B, etc.)
  - [ ] Word devices (D, W, R, ZR, etc.)
  - [ ] Special registers
- [ ] Test data
  - [ ] Pre-configured device memory
  - [ ] Simulated I/O
  - [ ] Various data types
  - [ ] Realistic manufacturing scenarios
- [ ] Features
  - [ ] TCP/IP server (port 5007)
  - [ ] Console logging for all operations
  - [ ] CLI controls for changing values
  - [ ] Auto-updating device values
  - [ ] PLC status simulation
  - [ ] Error simulation
- [ ] Documentation
  - [ ] README.md with PLC configuration
  - [ ] Device memory map
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
  - [ ] Test with Mitsubishi iQ-R series PLCs
  - [ ] Test with iQ-F series PLCs
  - [ ] Test with Q series PLCs
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
  - [ ] MC Protocol overview
  - [ ] Device type reference
  - [ ] Feature comparison with MODBUS-Project
- [ ] Individual component READMEs
  - [ ] Complete API documentation
  - [ ] Environment variable reference
  - [ ] Troubleshooting guides
  - [ ] Device mapping guide
  - [ ] Example use cases
- [ ] MCP configuration examples
  - [ ] Claude Desktop configs (Python & NPM)
  - [ ] Other MCP client examples
- [ ] Device map examples
  - [ ] Sample device files for common scenarios
  - [ ] Naming conventions
  - [ ] Best practices
- [ ] Video/GIF demonstrations
  - [ ] Setup and connection
  - [ ] Common operations
  - [ ] AI agent interaction examples

## Code Structure Details

### Python Server Architecture

```python
# src/melsec_mcp/server.py
class MELSECMCPServer:
    def __init__(self):
        self.client = MCProtocolClient()
        self.device_map = DeviceMap()
        
    async def run(self):
        # Initialize MCP server
        # Register all tools
        # Start stdio transport

# src/melsec_mcp/mc_client.py
import socket

class MCProtocolClient:
    def __init__(self, host='192.168.1.10', port=5007, protocol='3E'):
        self.host = host
        self.port = port
        self.protocol = protocol
        
    def read_device(self, device_type, address, count):
        # Read device memory
        
    def write_device(self, device_type, address, values):
        # Write device memory
        
    def remote_run(self):
        # Set PLC to RUN mode
```

### NPM Server Architecture

```typescript
// src/index.ts
class MELSECMCPServer {
  private client: MCProtocolClient;
  private deviceMap: DeviceMap;
  
  async run() {
    // Initialize MCP server
    // Register tools
    // Start stdio transport
  }
}

// MC Protocol client wrapper
class MCProtocolClient {
  private host: string;
  private port: number;
  private protocol: string;
  
  constructor(host: string = '192.168.1.10', port: number = 5007, protocol: string = '3E') {
    this.host = host;
    this.port = port;
    this.protocol = protocol;
  }
  
  async readDevice(deviceType: string, address: number, count: number): Promise<any[]> { }
  async writeDevice(deviceType: string, address: number, values: any[]): Promise<void> { }
  async remoteRun(): Promise<void> { }
}
```

## Tool Response Format

All tools return a consistent format:

```json
{
  "success": true,
  "data": {
    "device_type": "D",
    "start_address": 1000,
    "values": [100, 250, 75],
    "data_type": "INT16"
  },
  "error": null,
  "meta": {
    "timestamp": "2025-11-28T20:06:00Z",
    "plc_host": "192.168.1.10:5007",
    "protocol": "3E",
    "frame_type": "binary",
    "execution_time_ms": 15
  }
}
```

## Example Tool Calls

### Read Device
```json
{
  "tool": "read_device",
  "parameters": {
    "device_type": "D",
    "start_address": 1000,
    "count": 10
  }
}
```

### Write Device
```json
{
  "tool": "write_device",
  "parameters": {
    "device_type": "D",
    "start_address": 1000,
    "values": [100, 200, 300]
  }
}
```

### Read Bits
```json
{
  "tool": "read_bits",
  "parameters": {
    "device_type": "M",
    "start_address": 100,
    "count": 16
  }
}
```

### Remote Run
```json
{
  "tool": "remote_run",
  "parameters": {}
}
```

### Read Float32
```json
{
  "tool": "read_float32",
  "parameters": {
    "device_type": "D",
    "start_address": 2000
  }
}
```

### Using Device Map (Alias)
```json
{
  "tool": "read_device_by_alias",
  "parameters": {
    "alias": "ProductCounter"
  }
}
```

## Dependencies & Requirements

### System Requirements
- **Python**: 3.10 or higher
- **Node.js**: 18 or higher (for NPM version)
- **uv**: For Python dependency management
- **Network Access**: TCP connectivity to MELSEC PLC

### Python Dependencies
```toml
dependencies = [
    "mcp[cli]>=1.6.0",
    "pymcprotocol>=0.1.0",
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

1. **Write Protection**: Default `MC_WRITES_ENABLED=true` with option to disable
2. **Remote Operations**: `MC_REMOTE_OPS_ENABLED=false` by default
3. **Input Validation**: All tool inputs validated before MC Protocol operations
4. **Network Isolation**: Recommend dedicated PLC network
5. **Audit Logging**: Optional logging of all write and remote operations
6. **PLC Password**: Support for PLC password protection (if configured)

## Testing Strategy

### Mock PLC Test Cases
1. **Device Reading**: Read all device types
2. **Device Writing**: Write various device types
3. **Batch Operations**: Batch read/write
4. **Remote Operations**: RUN/STOP/PAUSE/RESET
5. **Data Types**: All data type conversions
6. **Error Handling**: Invalid addresses, communication failures
7. **Device Map System**: Alias resolution, read/write by alias

### Real Hardware Testing
- Test with Mitsubishi iQ-R PLCs
- Test with iQ-F PLCs
- Test with Q series PLCs
- Test with L series PLCs
- Verify data integrity
- Performance testing (latency, throughput)
- Multi-PLC scenarios
- Different frame types (3E/4E, ASCII/Binary)

## Performance Targets

- **Device Read**: < 50ms
- **Device Write**: < 75ms
- **Batch Read**: < 100ms (10 devices)
- **Batch Write**: < 150ms (10 devices)
- **Remote Operation**: < 200ms
- **Status Check**: < 30ms

## Troubleshooting Guide

Common issues and solutions to document:

1. **Connection Failed**
   - Verify IP address and port (5007 for 3E)
   - Check network connectivity
   - Ensure PLC Ethernet module is configured
   - Verify firewall settings

2. **No Response**
   - Check PLC is in RUN or STOP mode
   - Verify protocol type (3E vs 4E)
   - Check frame type (binary vs ASCII)
   - Ensure correct network/station numbers

3. **Write Failed**
   - Check write protection settings
   - Verify PLC is not in test mode
   - Check device is writable
   - Review MC_WRITES_ENABLED setting

4. **Invalid Device**
   - Verify device type is valid for PLC model
   - Check address range
   - Ensure device exists in PLC
   - Review PLC memory configuration

5. **Data Type Mismatch**
   - Check word count for data type
   - Verify byte order (endianness)
   - Ensure proper type conversion

## MC Protocol Details

### Supported Frame Types
- **3E Frame**: Standard frame format
  - Binary mode (recommended)
  - ASCII mode
- **4E Frame**: Extended frame format
  - Binary mode
  - ASCII mode

### Device Types
- **Bit Devices**: X, Y, M, L, F, B, SB, etc.
- **Word Devices**: D, W, R, ZR, etc.
- **Special**: SD (Special register), SW (Special link register)

### Supported PLC Series
- **iQ-R Series**: RJ71EN71, RJ71EIP91, etc.
- **iQ-F Series**: FX5U, FX5UC, etc.
- **Q Series**: QJ71E71-100, etc.
- **L Series**: LJ71E71-100, etc.

### Command Types
- **Batch Read**: Read multiple device blocks
- **Batch Write**: Write multiple device blocks
- **Random Read**: Read random addresses
- **Random Write**: Write random addresses
- **Remote Run/Stop**: PLC control
- **File Operations**: Memory card access

## Future Enhancements

- [ ] MC Protocol over UDP support
- [ ] ETH module configuration
- [ ] Routing tables for multi-drops
- [ ] Advanced monitoring with triggers
- [ ] Program upload/download
- [ ] Parameter read/write
- [ ] Web UI for PLC visualization
- [ ] Integration with GX Works
- [ ] Multi-CPU support
- [ ] CC-Link IE integration

## Success Criteria

This project will be considered complete when:

1. ✅ Both Python and NPM servers are fully functional
2. ✅ All core tools are implemented and tested
3. ✅ Mock PLC provides realistic testing environment
4. ✅ Device read/write operations work reliably
5. ✅ Batch operations function correctly
6. ✅ Remote operations work properly
7. ✅ Comprehensive documentation is complete
8. ✅ Successfully tested with real MELSEC PLCs
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

- [MELSEC Communication Protocol Reference Manual](https://www.mitsubishielectric.com/fa/products/cnt/plcnet/pmerit/mcprotocol/index.html)
- [pymcprotocol Documentation](https://pypi.org/project/pymcprotocol/)
- [MC Protocol Technical Documentation](https://www.mitsubishielectric.com/fa/document/manual/)
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [MODBUS-Project Reference](../../MODBUS-Project/)

---

**Document Version**: 1.0  
**Created**: 2025-11-28  
**Last Updated**: 2025-11-28  
**Status**: Planning Phase
