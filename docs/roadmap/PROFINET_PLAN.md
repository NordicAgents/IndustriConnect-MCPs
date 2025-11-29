# PROFINET MCP Server - Implementation Plan
## Siemens Industrial Ethernet Protocol

## Project Overview

This plan outlines the development of a **Model Context Protocol (MCP) server for PROFINET** - Siemens' industrial Ethernet standard for automation. The implementation will follow the proven architecture from the MODBUS-Project, enabling AI agents and MCP-compatible applications to communicate with PROFINET devices (IO Devices, IO Controllers, Field Devices).

## Project Goals

- Create a production-ready MCP server for PROFINET protocol
- Support both Python and NPM/TypeScript implementations
- Provide comprehensive tooling for device discovery, I/O operations, and diagnostics
- Include a mock PROFINET device for testing and development
- Maintain consistency with the MODBUS-Project architecture and patterns
- Enable seamless AI agent integration with PROFINET industrial networks

## Repository Structure

```
PROFINET-Project/
├── .gitignore                    # Combined ignore patterns (Python, Node, IDE)
├── README.md                     # Main project documentation
├── profinet-python/              # Python MCP server implementation
│   ├── .gitignore
│   ├── .python-version
│   ├── README.md
│   ├── pyproject.toml           # uv/pip configuration
│   ├── uv.lock
│   └── src/
│       └── profinet_mcp/
│           ├── __init__.py
│           ├── cli.py           # Entry point (profinet-mcp command)
│           ├── server.py        # MCP server implementation
│           ├── tools.py         # PROFINET tool definitions
│           ├── pn_client.py     # PROFINET protocol client wrapper
│           └── gsd_parser.py    # GSD file parser
├── profinet-npm/                # NPM/TypeScript MCP server
│   ├── .gitignore
│   ├── README.md
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── mcp-config-example.json
│   └── src/
│       ├── index.ts             # Main MCP server + tools
│       └── gsdParser.ts         # GSD file parser
└── profinet-mock-server/        # Mock PROFINET device for testing
    ├── .gitignore
    ├── README.md
    ├── pyproject.toml
    └── profinet_mock_device.py  # Simulated PROFINET IO Device
```

## Technology Stack

### Python Implementation (profinet-python)
- **Python**: 3.10+
- **Package Manager**: uv (modern, fast dependency manager)
- **MCP SDK**: `mcp[cli]>=1.6.0`
- **PROFINET Protocol**: Custom implementation or `pyprofinet` (if available)
- **Alternative**: Use `python-snap7` for PROFINET via S7 connection
- **GSD Parser**: `xml.etree.ElementTree` or `lxml`
- **Environment**: `python-dotenv>=1.1.0`
- **Build System**: hatchling

### NPM Implementation (profinet-npm)
- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.6+
- **MCP SDK**: `@modelcontextprotocol/sdk@^1.2.0`
- **PROFINET Protocol**: Custom implementation or available libraries
- **GSD Parser**: `xml2js` or `fast-xml-parser`
- **Environment**: `dotenv@^16.4.5`
- **Build**: TypeScript compiler

### Mock Server (profinet-mock-server)
- **Python**: 3.10+
- **Framework**: Custom PROFINET DCP and RT protocol implementation
- **Package Manager**: uv

## Core Features & Tools

### 1. Device Discovery & Configuration
- **discover_devices**: Discover PROFINET devices on network (DCP)
  - Returns: device name, MAC address, IP address, vendor, device type
- **get_device_info**: Get detailed device information
- **set_device_name**: Set PROFINET device name
- **set_device_ip**: Set device IP configuration (IP, subnet, gateway)
- **identify_device**: Trigger LED blinking for device identification

### 2. I/O Data Operations
- **read_io_data**: Read input/output data from IO device
  - Parameters: device_name, slot, subslot, data_length
- **write_io_data**: Write output data to IO device
  - Parameters: device_name, slot, subslot, data
- **read_cyclic_data**: Read cyclic real-time data
- **write_cyclic_data**: Write cyclic real-time data

### 3. Module & Slot Operations
- **get_device_modules**: Get list of modules and submodules
  - Returns: slot, subslot, module_id, submodule_id, I/O size
- **read_module_data**: Read data from specific module/submodule
- **write_module_data**: Write data to specific module/submodule

### 4. Diagnostic & Alarm Functions
- **read_diagnostics**: Read device diagnostics
  - Channel diagnostics, extended channel diagnostics
- **read_alarms**: Read alarm information
- **get_device_status**: Get operational status (good, maintenance required, error)
- **read_records**: Read PROFINET records (diagnostic records, identification records)

### 5. GSD File Management
- **load_gsd_file**: Load and parse GSD/GSDML file
- **get_supported_modules**: Get list of supported modules from GSD
- **get_module_configuration**: Get module configuration from GSD
- **validate_configuration**: Validate device configuration against GSD

### 6. Network Management
- **scan_network**: Scan network for PROFINET devices
- **get_topology**: Get network topology information
- **check_station_status**: Check if station is reachable

### 7. Device Map System
- **list_devices**: List all configured devices from map
- **read_device_by_alias**: Read by alias name
- **write_device_by_alias**: Write by alias name
- Device configuration file format (JSON):
```json
{
  "ConveyorMotor": {
    "device_name": "MOTOR-01",
    "ip_address": "192.168.1.100",
    "slot": 1,
    "subslot": 1,
    "description": "Main conveyor motor drive",
    "gsd_file": "/path/to/device.xml",
    "io_mapping": {
      "speed": {"offset": 0, "type": "INT", "unit": "RPM"},
      "current": {"offset": 2, "type": "REAL", "unit": "A"}
    }
  },
  "TempSensor": {
    "device_name": "TEMP-SENSOR-01",
    "ip_address": "192.168.1.101",
    "slot": 0,
    "subslot": 1,
    "description": "Temperature sensor module",
    "gsd_file": "/path/to/sensor.xml"
  }
}
```

### 8. Health & Diagnostics
- **ping**: Connection health check and configuration report
- **get_connection_status**: Detailed connection status
- **test_device_communication**: Test communication with specific device

## Environment Variables

```bash
# Network Settings
PROFINET_INTERFACE=eth0          # Network interface for PROFINET (default: eth0)
PROFINET_CONTROLLER_IP=192.168.1.1  # Controller IP address
PROFINET_NETWORK=192.168.1.0/24  # PROFINET network range

# DCP Settings
PROFINET_DCP_PORT=34964          # DCP port (default: 34964 UDP)
PROFINET_DCP_TIMEOUT=5           # DCP timeout in seconds (default: 5)

# Real-Time Settings
PROFINET_RT_ENABLED=true         # Enable real-time communication (default: true)
PROFINET_IRT_ENABLED=false       # Enable isochronous real-time (default: false)
PROFINET_CYCLE_TIME=10           # Cycle time in ms (default: 10)

# Protocol Settings
PROFINET_TIMEOUT=10              # General timeout in seconds (default: 10)
PROFINET_MAX_RETRIES=3           # Retry attempts (default: 3)
PROFINET_RETRY_BACKOFF_BASE=0.5  # Backoff base in seconds (default: 0.5)

# GSD Configuration
PROFINET_GSD_PATH=/path/to/gsd   # Path to GSD files directory
PROFINET_AUTO_LOAD_GSD=true      # Auto-load GSD files (default: true)

# Security Settings
PROFINET_WRITES_ENABLED=true     # Allow write operations (default: true)
PROFINET_CONFIG_CMDS_ENABLED=false  # Allow config commands like set IP (default: false)

# Device Map
DEVICE_MAP_FILE=/path/to/devices.json  # Optional device configuration file

# Debugging
PROFINET_DEBUG=false             # Enable debug logging (default: false)
PROFINET_LOG_DCP_PACKETS=false   # Log DCP packets (default: false)
PROFINET_LOG_RT_DATA=false       # Log real-time data (default: false)
```

## Implementation Phases

### Phase 1: Project Setup & Foundation ✅
- [ ] Create directory structure
- [ ] Set up .gitignore files (Python, Node, IDE files)
- [ ] Initialize Python project with uv
  - [ ] Create pyproject.toml
  - [ ] Set Python version (.python-version file)
  - [ ] Configure dependencies (scapy for network, mcp, dotenv)
- [ ] Initialize NPM project
  - [ ] Create package.json with bin entry
  - [ ] Configure TypeScript (tsconfig.json)
  - [ ] Add dependencies (MCP SDK, network libraries)
- [ ] Create main README.md

### Phase 2: Python MCP Server (profinet-python)
- [ ] Core infrastructure
  - [ ] Set up MCP server scaffold (server.py)
  - [ ] Create PROFINET client wrapper (pn_client.py)
  - [ ] Implement DCP protocol (discovery)
  - [ ] Implement network interface handling
  - [ ] Add environment variable configuration
  - [ ] Create CLI entry point (cli.py)
- [ ] GSD file parser
  - [ ] XML parsing for GSDML files
  - [ ] Module/submodule extraction
  - [ ] I/O configuration parsing
  - [ ] Device capability detection
- [ ] Device discovery tools
  - [ ] discover_devices tool (DCP)
  - [ ] get_device_info tool
  - [ ] set_device_name tool
  - [ ] set_device_ip tool
  - [ ] identify_device tool
- [ ] I/O operations
  - [ ] read_io_data tool
  - [ ] write_io_data tool
  - [ ] read_cyclic_data tool
  - [ ] write_cyclic_data tool
- [ ] Module operations
  - [ ] get_device_modules tool
  - [ ] read_module_data tool
  - [ ] write_module_data tool
- [ ] Diagnostic tools
  - [ ] read_diagnostics tool
  - [ ] read_alarms tool
  - [ ] get_device_status tool
  - [ ] read_records tool
- [ ] Device map system
  - [ ] Device file parser (JSON)
  - [ ] list_devices tool
  - [ ] read_device_by_alias tool
  - [ ] write_device_by_alias tool
- [ ] Network tools
  - [ ] scan_network tool
  - [ ] get_topology tool
  - [ ] check_station_status tool
- [ ] Health & diagnostics
  - [ ] ping tool
  - [ ] get_connection_status tool
  - [ ] test_device_communication tool
- [ ] Error handling & validation
  - [ ] Unified response format: `{success, data, error, meta}`
  - [ ] Input validation for all tools
  - [ ] PROFINET status code translation
  - [ ] Comprehensive error messages
- [ ] Documentation
  - [ ] README.md with installation, configuration, examples
  - [ ] Tool documentation with schemas
  - [ ] GSD file usage guide
  - [ ] MCP client configuration examples

### Phase 3: NPM/TypeScript MCP Server (profinet-npm)
- [ ] Port Python implementation to TypeScript
  - [ ] MCP server setup
  - [ ] PROFINET client implementation
  - [ ] DCP protocol implementation
  - [ ] Network interface handling
  - [ ] Environment configuration
- [ ] Implement all tools (matching Python API)
  - [ ] Device discovery operations
  - [ ] I/O operations
  - [ ] Module operations
  - [ ] Diagnostic tools
  - [ ] GSD file parsing
  - [ ] Device map system
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

### Phase 4: Mock PROFINET Device (profinet-mock-server)
- [ ] Device implementation
  - [ ] DCP server (device discovery, name/IP setting)
  - [ ] Device identification
  - [ ] Basic PROFINET RT communication
  - [ ] Configurable device type
- [ ] Module simulation
  - [ ] Multiple slots/subslots
  - [ ] Various I/O data types
  - [ ] Diagnostic data generation
- [ ] Test data
  - [ ] Pre-configured modules
  - [ ] Simulated I/O values
  - [ ] Alarm/diagnostic scenarios
  - [ ] Realistic industrial scenarios
- [ ] Features
  - [ ] Configurable network interface
  - [ ] Console logging for all operations
  - [ ] CLI controls for changing values
  - [ ] Auto-updating I/O values
  - [ ] GSD file generation
- [ ] Documentation
  - [ ] README.md with device configuration
  - [ ] Module/slot mapping
  - [ ] Usage examples
  - [ ] Integration testing guide

### Phase 5: Testing & Integration
- [ ] Unit tests
  - [ ] Python tool tests
  - [ ] TypeScript tool tests
  - [ ] Mock device tests
  - [ ] GSD parser tests
- [ ] Integration tests
  - [ ] Python MCP server ↔ Mock device
  - [ ] NPM MCP server ↔ Mock device
  - [ ] Tool output consistency between Python/NPM
  - [ ] Multi-device scenarios
- [ ] Real hardware testing
  - [ ] Test with Siemens PROFINET devices
  - [ ] Test with third-party PROFINET devices
  - [ ] Verify all tools work correctly
  - [ ] Performance benchmarking
  - [ ] Real-time communication validation
- [ ] MCP client testing
  - [ ] Claude Desktop integration
  - [ ] MCP Inspector testing
  - [ ] Multi-tool workflow tests

### Phase 6: Documentation & Polish
- [ ] Main README.md
  - [ ] Project overview
  - [ ] Quick start guide
  - [ ] Architecture overview
  - [ ] PROFINET protocol overview
  - [ ] Feature comparison with MODBUS-Project
- [ ] Individual component READMEs
  - [ ] Complete API documentation
  - [ ] Environment variable reference
  - [ ] Troubleshooting guides
  - [ ] GSD file management guide
  - [ ] Example use cases
- [ ] MCP configuration examples
  - [ ] Claude Desktop configs (Python & NPM)
  - [ ] Other MCP client examples
- [ ] Device map examples
  - [ ] Sample device files for common scenarios
  - [ ] Device naming conventions
  - [ ] Best practices
- [ ] Video/GIF demonstrations
  - [ ] Setup and device discovery
  - [ ] Common operations
  - [ ] AI agent interaction examples

## Code Structure Details

### Python Server Architecture

```python
# src/profinet_mcp/server.py
class PROFINETMCPServer:
    def __init__(self):
        self.client = ProfinetClient()
        self.device_map = DeviceMap()
        self.gsd_parser = GSDParser()
        
    async def run(self):
        # Initialize MCP server
        # Register all tools
        # Start stdio transport

# src/profinet_mcp/pn_client.py
class ProfinetClient:
    def __init__(self, interface='eth0', ...):
        self.interface = interface
        self.devices = {}
        
    def discover_devices(self):
        # DCP discovery
        
    def read_io_data(self, device_name, slot, subslot, length):
        # Read I/O data
        
    def write_io_data(self, device_name, slot, subslot, data):
        # Write I/O data

# src/profinet_mcp/gsd_parser.py
class GSDParser:
    def parse_gsd(self, filepath):
        # Parse GSDML file
        
    def get_modules(self):
        # Get module list
```

### NPM Server Architecture

```typescript
// src/index.ts
class PROFINETMCPServer {
  private client: ProfinetClient;
  private deviceMap: DeviceMap;
  private gsdParser: GSDParser;
  
  async run() {
    // Initialize MCP server
    // Register tools
    // Start stdio transport
  }
}

// PROFINET client wrapper
class ProfinetClient {
  private interface: string;
  private devices: Map<string, Device>;
  
  constructor(iface: string = 'eth0') {
    this.interface = iface;
  }
  
  async discoverDevices(): Promise<Device[]> { }
  async readIOData(deviceName: string, slot: number, subslot: number): Promise<Buffer> { }
  async writeIOData(deviceName: string, slot: number, subslot: number, data: Buffer): Promise<void> { }
}
```

## Tool Response Format

All tools return a consistent format:

```json
{
  "success": true,
  "data": {
    "device_name": "MOTOR-01",
    "slot": 1,
    "subslot": 1,
    "value": {
      "speed": 1425,
      "current": 12.5,
      "status": "running"
    },
    "raw_data": "0x59 0x05 0x41 0x48 0x00 0x00 0x01"
  },
  "error": null,
  "meta": {
    "timestamp": "2025-11-28T18:25:00Z",
    "device_ip": "192.168.1.100",
    "device_mac": "00:0E:8C:12:34:56",
    "execution_time_ms": 15,
    "profinet_status": "Good"
  }
}
```

## Example Tool Calls

### Discover Devices
```json
{
  "tool": "discover_devices",
  "parameters": {
    "timeout": 5
  }
}
```

### Get Device Info
```json
{
  "tool": "get_device_info",
  "parameters": {
    "device_name": "MOTOR-01"
  }
}
```

### Read I/O Data
```json
{
  "tool": "read_io_data",
  "parameters": {
    "device_name": "MOTOR-01",
    "slot": 1,
    "subslot": 1,
    "data_length": 8
  }
}
```

### Write I/O Data
```json
{
  "tool": "write_io_data",
  "parameters": {
    "device_name": "MOTOR-01",
    "slot": 1,
    "subslot": 1,
    "data": [0x01, 0x00, 0x64, 0x00]
  }
}
```

### Set Device IP
```json
{
  "tool": "set_device_ip",
  "parameters": {
    "device_name": "MOTOR-01",
    "ip_address": "192.168.1.100",
    "subnet_mask": "255.255.255.0",
    "gateway": "192.168.1.1"
  }
}
```

### Load GSD File
```json
{
  "tool": "load_gsd_file",
  "parameters": {
    "filepath": "/path/to/GSDML-V2.35-Siemens-Device-20230101.xml"
  }
}
```

### Read Diagnostics
```json
{
  "tool": "read_diagnostics",
  "parameters": {
    "device_name": "MOTOR-01",
    "slot": 1,
    "subslot": 1
  }
}
```

### Using Device Map (Alias)
```json
{
  "tool": "read_device_by_alias",
  "parameters": {
    "alias": "ConveyorMotor"
  }
}
```

## Dependencies & Requirements

### System Requirements
- **Python**: 3.10 or higher
- **Node.js**: 18 or higher (for NPM version)
- **uv**: For Python dependency management
- **Network Access**: Root/admin privileges may be required for raw socket access
- **Network Interface**: Dedicated PROFINET network interface recommended

### Python Dependencies
```toml
dependencies = [
    "mcp[cli]>=1.6.0",
    "scapy>=2.5.0",
    "python-dotenv>=1.1.0",
    "lxml>=4.9.0",
]
```

### NPM Dependencies
```json
"dependencies": {
  "@modelcontextprotocol/sdk": "^1.2.0",
  "dotenv": "^16.4.5",
  "raw-socket": "^1.7.0",
  "fast-xml-parser": "^4.3.0"
}
```

## Security Considerations

1. **Write Protection**: Default `PROFINET_WRITES_ENABLED=true` with option to disable
2. **Configuration Commands**: `PROFINET_CONFIG_CMDS_ENABLED=false` by default (set IP, etc.)
3. **Input Validation**: All tool inputs validated before PROFINET operations
4. **Network Isolation**: Recommend dedicated PROFINET network
5. **Audit Logging**: Optional logging of all write and configuration operations
6. **Root Privileges**: Handle carefully for raw socket access

## Testing Strategy

### Mock Device Test Cases
1. **Discovery Tests**: DCP discovery, device identification
2. **I/O Operations**: Read/write various data types and sizes
3. **Configuration**: Set device name, IP configuration
4. **Diagnostics**: Read diagnostics, alarms, status
5. **GSD Parsing**: Parse various GSDML files
6. **Error Handling**: Invalid devices, communication failures
7. **Device Map System**: Alias resolution, read/write by alias

### Real Hardware Testing
- Test with Siemens PROFINET IO devices
- Test with third-party PROFINET devices
- Verify real-time communication
- Verify data integrity across all data types
- Performance testing (cycle time, latency)
- Multi-device scenarios

## Performance Targets

- **Device Discovery**: < 5 seconds
- **Single I/O Read**: < 10ms
- **Single I/O Write**: < 15ms
- **Cyclic Data Exchange**: As per configured cycle time (typically 1-100ms)
- **Diagnostic Read**: < 50ms
- **GSD Parsing**: < 500ms per file
- **Device Lookup (from cache)**: < 1ms

## Troubleshooting Guide

Common issues and solutions to document:

1. **Discovery Failed**
   - Verify network interface is correct
   - Check firewall allows UDP port 34964
   - Ensure on same network segment
   - Verify network cable connection

2. **Permission Denied**
   - May need root/admin for raw sockets
   - Use `sudo` or run as administrator
   - Set proper capabilities on Linux

3. **Device Not Found**
   - Verify device name is correct
   - Use discover_devices to find devices
   - Check device is powered on
   - Verify network configuration

4. **Communication Timeout**
   - Check network connectivity
   - Verify device IP address
   - Ensure device is in correct mode
   - Check cycle time configuration

5. **GSD Parse Error**
   - Verify GSD file is valid XML
   - Check GSDML version compatibility
   - Ensure file is not corrupted

## PROFINET Protocol Details

### Supported Features
- **DCP** (Discovery and Configuration Protocol)
- **PROFINET RT** (Real-Time)
- **Acyclic Read/Write**
- **Diagnostic Records**
- **GSD/GSDML File Support**

### Limitations
- **PROFINET IRT**: May require specialized hardware
- **PROFIsafe**: Safety protocol not initially supported
- **PROFINET TSN**: Time-Sensitive Networking not initially supported

## Future Enhancements

- [ ] PROFINET IRT (Isochronous Real-Time) support
- [ ] PROFIsafe protocol implementation
- [ ] PROFINET TSN (Time-Sensitive Networking)
- [ ] Advanced topology detection
- [ ] Network load analysis
- [ ] Web UI for device management
- [ ] GSD file repository integration
- [ ] Automatic device configuration
- [ ] Multi-controller coordination
- [ ] Integration with TIA Portal

## Success Criteria

This project will be considered complete when:

1. ✅ Both Python and NPM servers are fully functional
2. ✅ All core tools are implemented and tested
3. ✅ Mock device provides realistic testing environment
4. ✅ GSD file parsing works correctly
5. ✅ Device discovery (DCP) functions properly
6. ✅ Comprehensive documentation is complete
7. ✅ Successfully tested with real PROFINET devices
8. ✅ Claude Desktop integration works seamlessly
9. ✅ Performance targets are met
10. ✅ Security best practices are implemented

## Timeline Estimate

- **Phase 1** (Setup): 1-2 days
- **Phase 2** (Python Server): 7-10 days
- **Phase 3** (NPM Server): 4-6 days
- **Phase 4** (Mock Device): 3-5 days
- **Phase 5** (Testing): 4-6 days
- **Phase 6** (Documentation): 2-3 days

**Total Estimated Time**: 21-32 days

## References

- [PROFINET Specification](https://www.profibus.com/download/profinet-specification/)
- [PI (PROFIBUS & PROFINET International)](https://www.profibus.com/)
- [GSDML Specification](https://www.profibus.com/download/gsdml-specification/)
- [Scapy Documentation](https://scapy.readthedocs.io/)
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [MODBUS-Project Reference](../../MODBUS-Project/)
- [Siemens PROFINET Documentation](https://support.industry.siemens.com/)

---

**Document Version**: 1.0  
**Created**: 2025-11-28  
**Last Updated**: 2025-11-28  
**Status**: Planning Phase
