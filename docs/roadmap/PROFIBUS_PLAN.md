# PROFIBUS MCP Server - Implementation Plan
## Siemens Serial Fieldbus Protocol

## Project Overview

This plan outlines the development of a **Model Context Protocol (MCP) server for PROFIBUS** - Siemens' established serial fieldbus standard for industrial automation. The implementation will follow the proven architecture from the MODBUS-Project, enabling AI agents and MCP-compatible applications to communicate with PROFIBUS devices (DP slaves, PA devices, and field instruments).

## Project Goals

- Create a production-ready MCP server for PROFIBUS protocol
- Support both Python and NPM/TypeScript implementations
- Provide comprehensive tooling for master/slave operations, diagnostics, and configuration
- Include a mock PROFIBUS slave for testing and development
- Maintain consistency with the MODBUS-Project architecture and patterns
- Enable seamless AI agent integration with PROFIBUS fieldbus networks
- Support PROFIBUS-DP and PROFIBUS-PA variants

## Repository Structure

```
PROFIBUS-Project/
├── .gitignore                    # Combined ignore patterns (Python, Node, IDE)
├── README.md                     # Main project documentation
├── profibus-python/              # Python MCP server implementation
│   ├── .gitignore
│   ├── .python-version
│   ├── README.md
│   ├── pyproject.toml           # uv/pip configuration
│   ├── uv.lock
│   └── src/
│       └── profibus_mcp/
│           ├── __init__.py
│           ├── cli.py           # Entry point (profibus-mcp command)
│           ├── server.py        # MCP server implementation
│           ├── tools.py         # PROFIBUS tool definitions
│           ├── pb_master.py     # PROFIBUS master wrapper
│           └── gsd_parser.py    # GSD file parser
├── profibus-npm/                # NPM/TypeScript MCP server
│   ├── .gitignore
│   ├── README.md
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── mcp-config-example.json
│   └── src/
│       ├── index.ts             # Main MCP server + tools
│       └── gsdParser.ts         # GSD file parser
└── profibus-mock-slave/         # Mock PROFIBUS slave for testing
    ├── .gitignore
    ├── README.md
    ├── pyproject.toml
    └── profibus_mock_slave.py   # Simulated PROFIBUS DP slave
```

## Technology Stack

### Python Implementation (profibus-python)
- **Python**: 3.10+
- **Package Manager**: uv (modern, fast dependency manager)
- **MCP SDK**: `mcp[cli]>=1.6.0`
- **PROFIBUS Protocol**: Custom implementation or available libraries
- **Serial Communication**: `pyserial>=3.5`
- **GSD Parser**: `xml.etree.ElementTree` or `lxml`
- **Environment**: `python-dotenv>=1.1.0`
- **Build System**: hatchling

### NPM Implementation (profibus-npm)
- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.6+
- **MCP SDK**: `@modelcontextprotocol/sdk@^1.2.0`
- **PROFIBUS Protocol**: Custom implementation or available libraries
- **Serial Communication**: `serialport@^12.0.0`
- **GSD Parser**: `xml2js` or `fast-xml-parser`
- **Environment**: `dotenv@^16.4.5`
- **Build**: TypeScript compiler

### Mock Slave (profibus-mock-slave)
- **Python**: 3.10+
- **Framework**: Custom PROFIBUS DP protocol implementation
- **Package Manager**: uv

## Core Features & Tools

### 1. Network & Device Management
- **scan_bus**: Scan PROFIBUS network for slaves
  - Returns: slave address, ident number, status
- **get_slave_info**: Get detailed slave information
  - Returns: manufacturer, type, I/O configuration, diagnostic data
- **set_slave_address**: Configure slave address (if supported)
- **get_bus_parameters**: Get current bus parameters (baud rate, etc.)
- **set_bus_parameters**: Configure bus parameters

### 2. Data Exchange (DP Operations)
- **read_inputs**: Read input data from DP slave
  - Parameters: slave_address, length
  - Cyclic data from slave to master
- **write_outputs**: Write output data to DP slave
  - Parameters: slave_address, data
  - Cyclic data from master to slave
- **read_slave_data**: Read complete I/O data from slave
- **write_slave_data**: Write complete I/O data to slave

### 3. Acyclic Services
- **read_parameter**: Read parameter from slave
  - Slot, index-based access
- **write_parameter**: Write parameter to slave
- **read_memory**: Read slave memory
- **write_memory**: Write slave memory
- **read_diagnosis**: Read diagnostic data
- **get_slave_diagnosis**: Get extended diagnostic information

### 4. Configuration Services
- **set_slave_config**: Configure slave I/O structure
- **get_slave_config**: Read slave configuration
- **freeze_mode**: Freeze/unfreeze mode control
- **sync_mode**: Sync mode control
- **clear_mode**: Clear mode control

### 5. GSD File Management
- **load_gsd_file**: Load and parse GSD (General Station Description) file
- **get_supported_baudrates**: Get supported baud rates from GSD
- **get_module_configuration**: Get module configuration from GSD
- **validate_configuration**: Validate slave configuration against GSD

### 6. Diagnostic Functions
- **read_slave_diagnosis**: Read slave diagnostic data
  - Station status, master address, ident number
- **get_bus_statistics**: Get bus communication statistics
  - Error counters, telegram counts
- **check_slave_status**: Check if slave is operational
- **read_extended_diagnosis**: Read extended diagnostic information

### 7. Slave Map System
- **list_slaves**: List all configured slaves from map
- **read_slave_by_alias**: Read by alias name
- **write_slave_by_alias**: Write by alias name
- Slave configuration file format (JSON):
```json
{
  "TemperatureSensor": {
    "address": 5,
    "alias": "TempSensor1",
    "ident_number": "0x809C",
    "description": "PT100 temperature module",
    "gsd_file": "/path/to/SI809C.GSD",
    "io_config": {
      "input_length": 4,
      "output_length": 2
    },
    "parameters": {
      "range": "0-200°C",
      "unit": "celsius"
    }
  },
  "ValveController": {
    "address": 8,
    "alias": "Valve1",
    "ident_number": "0x80A5",
    "description": "Pneumatic valve controller",
    "gsd_file": "/path/to/SI80A5.GSD"
  }
}
```

### 8. Health & Diagnostics
- **ping**: Connection health check and configuration report
- **get_master_status**: Detailed master status
- **test_slave_communication**: Test communication with specific slave
- **get_bus_quality**: Assess bus communication quality

## Environment Variables

```bash
# Serial Port Settings
PROFIBUS_PORT=/dev/ttyUSB0       # Serial port (default: /dev/ttyUSB0)
PROFIBUS_BAUDRATE=500000         # Baud rate (9600, 19200, 93750, 187500, 500000, 1500000, 3000000, 6000000, 12000000)
PROFIBUS_ADAPTER_TYPE=CP5611     # Adapter type (CP5611, USB, etc.)

# Master Settings
PROFIBUS_MASTER_ADDRESS=2        # Master station address (default: 2)
PROFIBUS_MAX_SLAVES=126          # Maximum number of slaves (default: 126)
PROFIBUS_BUS_PROFILE=DP          # Bus profile: DP or PA (default: DP)

# Protocol Settings
PROFIBUS_TIMEOUT=1000            # Timeout in milliseconds (default: 1000)
PROFIBUS_MAX_RETRIES=3           # Retry attempts (default: 3)
PROFIBUS_RETRY_BACKOFF_BASE=0.1  # Backoff base in seconds (default: 0.1)

# Timing Parameters
PROFIBUS_SLOT_TIME=100           # Slot time in bit times (default: 100)
PROFIBUS_MIN_TSDR=11             # Min station delay time (default: 11)
PROFIBUS_MAX_TSDR=60             # Max station delay time (default: 60)
PROFIBUS_QUIET_TIME=0            # Quiet time in bit times (default: 0)

# GSD Configuration
PROFIBUS_GSD_PATH=/path/to/gsd   # Path to GSD files directory
PROFIBUS_AUTO_LOAD_GSD=true      # Auto-load GSD files (default: true)

# Security Settings
PROFIBUS_WRITES_ENABLED=true     # Allow write operations (default: true)
PROFIBUS_CONFIG_CMDS_ENABLED=false  # Allow configuration commands (default: false)

# Slave Map
SLAVE_MAP_FILE=/path/to/slaves.json  # Optional slave configuration file

# Debugging
PROFIBUS_DEBUG=false             # Enable debug logging (default: false)
PROFIBUS_LOG_TELEGRAMS=false     # Log PROFIBUS telegrams (default: false)
```

## Implementation Phases

### Phase 1: Project Setup & Foundation ✅
- [ ] Create directory structure
- [ ] Set up .gitignore files (Python, Node, IDE files)
- [ ] Initialize Python project with uv
  - [ ] Create pyproject.toml
  - [ ] Set Python version (.python-version file)
  - [ ] Configure dependencies (pyserial, mcp, dotenv)
- [ ] Initialize NPM project
  - [ ] Create package.json with bin entry
  - [ ] Configure TypeScript (tsconfig.json)
  - [ ] Add dependencies (MCP SDK, serialport)
- [ ] Create main README.md

### Phase 2: Python MCP Server (profibus-python)
- [ ] Core infrastructure
  - [ ] Set up MCP server scaffold (server.py)
  - [ ] Create PROFIBUS master wrapper (pb_master.py)
  - [ ] Implement serial communication layer
  - [ ] Implement FDL (Fieldbus Data Link) protocol
  - [ ] Add environment variable configuration
  - [ ] Create CLI entry point (cli.py)
- [ ] GSD file parser
 - [ ] Parse GSD files (both old and XML formats)
  - [ ] Extract device parameters
  - [ ] Extract I/O configuration
  - [ ] Extract diagnostic data structures
- [ ] Network & device management
  - [ ] scan_bus tool
  - [ ] get_slave_info tool
  - [ ] set_slave_address tool (if supported)
  - [ ] get_bus_parameters tool
  - [ ] set_bus_parameters tool
- [ ] Data exchange (DP operations)
  - [ ] read_inputs tool
  - [ ] write_outputs tool
  - [ ] read_slave_data tool
  - [ ] write_slave_data tool
  - [ ] Cyclic data exchange loop
- [ ] Acyclic services
  - [ ] read_parameter tool
  - [ ] write_parameter tool
  - [ ] read_memory tool
  - [ ] write_memory tool
  - [ ] read_diagnosis tool
- [ ] Configuration services
  - [ ] set_slave_config tool
  - [ ] get_slave_config tool
  - [ ] freeze_mode tool
  - [ ] sync_mode tool
  - [ ] clear_mode tool
- [ ] Diagnostic tools
  - [ ] read_slave_diagnosis tool
  - [ ] get_bus_statistics tool
  - [ ] check_slave_status tool
  - [ ] read_extended_diagnosis tool
- [ ] Slave map system
  - [ ] Slave file parser (JSON)
  - [ ] list_slaves tool
  - [ ] read_slave_by_alias tool
  - [ ] write_slave_by_alias tool
- [ ] Health & diagnostics
  - [ ] ping tool
  - [ ] get_master_status tool
  - [ ] test_slave_communication tool
  - [ ] get_bus_quality tool
- [ ] Error handling & validation
  - [ ] Unified response format: `{success, data, error, meta}`
  - [ ] Input validation for all tools
  - [ ] PROFIBUS error code translation
  - [ ] Comprehensive error messages
- [ ] Documentation
  - [ ] README.md with installation, configuration, examples
  - [ ] Tool documentation with schemas
  - [ ] GSD file usage guide
  - [ ] Bus parameter tuning guide
  - [ ] MCP client configuration examples

### Phase 3: NPM/TypeScript MCP Server (profibus-npm)
- [ ] Port Python implementation to TypeScript
  - [ ] MCP server setup
  - [ ] PROFIBUS master implementation
  - [ ] Serial communication (serialport)
  - [ ] FDL protocol implementation
  - [ ] Environment configuration
- [ ] Implement all tools (matching Python API)
  - [ ] Network & device management
  - [ ] Data exchange operations
  - [ ] Acyclic services
  - [ ] Configuration services
  - [ ] Diagnostic tools
  - [ ] GSD file parsing
  - [ ] Slave map system
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

### Phase 4: Mock PROFIBUS Slave (profibus-mock-slave)
- [ ] Slave implementation
  - [ ] PROFIBUS DP slave protocol stack
  - [ ] FDL slave state machine
  - [ ] Basic I/O data exchange
  - [ ] Diagnostic data generation
  - [ ] Configurable slave address
- [ ] GSD generation
  - [ ] Generate GSD file
  - [ ] Define I/O modules
  - [ ] Define parameters
- [ ] Test data
  - [ ] Pre-configured I/O data
  - [ ] Simulated process data
  - [ ] Various data types
  - [ ] Diagnostic scenarios
  - [ ] Realistic industrial scenarios
- [ ] Features
  - [ ] Serial port simulation
  - [ ] Console logging for all operations
  - [ ] CLI controls for changing values
  - [ ] Auto-updating I/O values
  - [ ] Multiple slave instances
- [ ] Documentation
  - [ ] README.md with slave configuration
  - [ ] I/O mapping documentation
  - [ ] Usage examples
  - [ ] Integration testing guide

### Phase 5: Testing & Integration
- [ ] Unit tests
  - [ ] Python tool tests
  - [ ] TypeScript tool tests
  - [ ] Mock slave tests
  - [ ] GSD parser tests
- [ ] Integration tests
  - [ ] Python MCP server ↔ Mock slave
  - [ ] NPM MCP server ↔ Mock slave
  - [ ] Tool output consistency between Python/NPM
  - [ ] Multi-slave scenarios
- [ ] Real hardware testing
  - [ ] Test with Siemens PROFIBUS devices
  - [ ] Test with third-party PROFIBUS slaves
  - [ ] Verify all tools work correctly
  - [ ] Performance benchmarking
  - [ ] Bus parameter optimization
- [ ] MCP client testing
  - [ ] Claude Desktop integration
  - [ ] MCP Inspector testing
  - [ ] Multi-tool workflow tests

### Phase 6: Documentation & Polish
- [ ] Main README.md
  - [ ] Project overview
  - [ ] Quick start guide
  - [ ] Architecture overview
  - [ ] PROFIBUS protocol overview
  - [ ] DP vs PA comparison
  - [ ] Feature comparison with MODBUS-Project
- [ ] Individual component READMEs
  - [ ] Complete API documentation
  - [ ] Environment variable reference
  - [ ] Troubleshooting guides
  - [ ] GSD file management guide
  - [ ] Bus configuration guide
  - [ ] Example use cases
- [ ] MCP configuration examples
  - [ ] Claude Desktop configs (Python & NPM)
  - [ ] Other MCP client examples
- [ ] Slave map examples
  - [ ] Sample slave files for common scenarios
  - [ ] Slave addressing conventions
  - [ ] Best practices
- [ ] Video/GIF demonstrations
  - [ ] Setup and bus scanning
  - [ ] Common operations
  - [ ] AI agent interaction examples

## Code Structure Details

### Python Server Architecture

```python
# src/profibus_mcp/server.py
class PROFIBUSMCPServer:
    def __init__(self):
        self.master = ProfiBusMaster()
        self.slave_map = SlaveMap()
        self.gsd_parser = GSDParser()
        
    async def run(self):
        # Initialize MCP server
        # Register all tools
        # Start stdio transport

# src/profibus_mcp/pb_master.py
import serial

class ProfiBusMaster:
    def __init__(self, port='/dev/ttyUSB0', baudrate=500000, ...):
        self.port = serial.Serial(port, baudrate)
        self.master_address = 2
        self.slaves = {}
        
    def scan_bus(self):
        # Scan for slaves on bus
        
    def read_inputs(self, slave_address, length):
        # Read input data from slave
        
    def write_outputs(self, slave_address, data):
        # Write output data to slave
        
    def read_diagnosis(self, slave_address):
        # Read diagnostic data

# src/profibus_mcp/gsd_parser.py
class GSDParser:
    def parse_gsd(self, filepath):
        # Parse GSD file (old or XML format)
        
    def get_io_config(self):
        # Get I/O configuration
```

### NPM Server Architecture

```typescript
// src/index.ts
import { SerialPort } from 'serialport';

class PROFIBUSMCPServer {
  private master: ProfiBusMaster;
  private slaveMap: SlaveMap;
  private gsdParser: GSDParser;
  
  async run() {
    // Initialize MCP server
    // Register tools
    // Start stdio transport
  }
}

// PROFIBUS master wrapper
class ProfiBusMaster {
  private port: SerialPort;
  private masterAddress: number;
  private slaves: Map<number, Slave>;
  
  constructor(portPath: string, baudrate: number = 500000) {
    this.port = new SerialPort({ path: portPath, baudRate: baudrate });
  }
  
  async scanBus(): Promise<Slave[]> { }
  async readInputs(slaveAddress: number, length: number): Promise<Buffer> { }
  async writeOutputs(slaveAddress: number, data: Buffer): Promise<void> { }
  async readDiagnosis(slaveAddress: number): Promise<DiagnosisData> { }
}
```

## Tool Response Format

All tools return a consistent format:

```json
{
  "success": true,
  "data": {
    "slave_address": 5,
    "value": {
      "temperature": 45.8,
      "status": 0x01,
      "alarm": false
    },
    "raw_data": "0x2D 0x01 0xC8 0x01 0x00"
  },
  "error": null,
  "meta": {
    "timestamp": "2025-11-28T19:38:00Z",
    "bus_baudrate": 500000,
    "master_address": 2,
    "slave_status": "OK",
    "execution_time_ms": 25
  }
}
```

## Example Tool Calls

### Scan Bus
```json
{
  "tool": "scan_bus",
  "parameters": {}
}
```

### Get Slave Info
```json
{
  "tool": "get_slave_info",
  "parameters": {
    "slave_address": 5
  }
}
```

### Read Inputs
```json
{
  "tool": "read_inputs",
  "parameters": {
    "slave_address": 5,
    "length": 4
  }
}
```

### Write Outputs
```json
{
  "tool": "write_outputs",
  "parameters": {
    "slave_address": 8,
    "data": [0x01, 0x00, 0xFF, 0x00]
  }
}
```

### Read Parameter
```json
{
  "tool": "read_parameter",
  "parameters": {
    "slave_address": 5,
    "slot": 0,
    "index": 10
  }
}
```

### Load GSD File
```json
{
  "tool": "load_gsd_file",
  "parameters": {
    "filepath": "/path/to/SI809C.GSD"
  }
}
```

### Read Diagnosis
```json
{
  "tool": "read_diagnosis",
  "parameters": {
    "slave_address": 5
  }
}
```

### Using Slave Map (Alias)
```json
{
  "tool": "read_slave_by_alias",
  "parameters": {
    "alias": "TemperatureSensor"
  }
}
```

## Dependencies & Requirements

### System Requirements
- **Python**: 3.10 or higher
- **Node.js**: 18 or higher (for NPM version)
- **uv**: For Python dependency management
- **Serial Port**: RS-485 adapter or PROFIBUS interface card
- **Hardware**: PROFIBUS master adapter (CP5611, USB adapter, etc.)

### Python Dependencies
```toml
dependencies = [
    "mcp[cli]>=1.6.0",
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

1. **Write Protection**: Default `PROFIBUS_WRITES_ENABLED=true` with option to disable
2. **Configuration Commands**: `PROFIBUS_CONFIG_CMDS_ENABLED=false` by default
3. **Input Validation**: All tool inputs validated before PROFIBUS operations
4. **Bus Isolation**: Recommend dedicated PROFIBUS segment
5. **Audit Logging**: Optional logging of all write and configuration operations
6. **Address Conflicts**: Prevent master address conflicts

## Testing Strategy

### Mock Slave Test Cases
1. **Bus Scan**: Slave discovery and enumeration
2. **Data Exchange**: Read/write I/O data
3. **Acyclic Services**: Parameter read/write
4. **Diagnostics**: Diagnostic data retrieval
5. **Configuration**: Slave configuration
6. **GSD Parsing**: Parse various GSD files
7. **Error Handling**: Communication failures, invalid addresses
8. **Slave Map System**: Alias resolution, read/write by alias

### Real Hardware Testing
- Test with Siemens PROFIBUS DP slaves
- Test with third-party devices
- Verify data integrity
- Performance testing (cycle time, latency)
- Multi-slave scenarios
- Different baud rates
- Bus parameter optimization

## Performance Targets

- **Bus Scan**: < 5 seconds (depends on address range)
- **Input Read**: < 50ms
- **Output Write**: < 50ms
- **Parameter Read**: < 100ms
- **Parameter Write**: < 150ms
- **Diagnostic Read**: < 100ms
- **Bus Cycle Time**: Depends on configuration (typically 10-100ms)

## Troubleshooting Guide

Common issues and solutions to document:

1. **Bus Scan Failed**
   - Verify serial port is correct
   - Check baud rate matches network
   - Ensure bus termination is proper
   - Verify power to slaves

2. **Permission Denied**
   - Add user to dialout group (Linux)
   - Check serial port permissions
   - May need sudo for some adapters

3. **Slave Not Found**
   - Check slave address configuration
   - Verify slave is powered
   - Check bus wiring
   - Run scan_bus

4. **Communication Timeout**
   - Check baud rate configuration
   - Verify slot time parameters
   - Check bus cable quality
   - Ensure proper termination

5. **Data Corruption**
   - Check for electrical noise
   - Verify grounding
   - Check cable shielding
   - Reduce baud rate if needed

6. **GSD Parse Error**
   - Verify GSD file format
   - Check file encoding
   - Ensure file is not corrupted

## PROFIBUS Protocol Details

### Supported Variants
- **PROFIBUS-DP** (Decentralized Periphery) - Fully supported
  - DP-V0: Basic cyclic data exchange
  - DP-V1: Acyclic services, diagnostics
  - DP-V2: Isochronous mode, clock synchronization
- **PROFIBUS-PA** (Process Automation) - Planned
  - Intrinsically safe
  - Power over bus

### Baud Rates
- 9.6 kbit/s
- 19.2 kbit/s
- 93.75 kbit/s
- 187.5 kbit/s
- 500 kbit/s (most common for DP)
- 1.5 Mbit/s
- 3 Mbit/s
- 6 Mbit/s
- 12 Mbit/s

### Limitations
- **Single Master**: Currently supports single master Class 1
- **Bus Length**: Depends on baud rate (e.g., 1000m at 93.75 kbit/s)
- **Max Slaves**: 126 slaves per segment
- **Repeaters**: May be needed for longer distances

## Future Enhancements

- [ ] PROFIBUS-PA support
- [ ] Multi-master (Class 2) support
- [ ] DP-V2 isochronous mode
- [ ] Redundancy support
- [ ] Advanced diagnostics and monitoring
- [ ] Web UI for bus visualization
- [ ] GSD file repository integration
- [ ] Automatic bus configuration
- [ ] Integration with SIMATIC tools
- [ ] Bus analyzer capabilities

## Success Criteria

This project will be considered complete when:

1. ✅ Both Python and NPM servers are fully functional
2. ✅ All core tools are implemented and tested
3. ✅ Mock slave provides realistic testing environment
4. ✅ GSD file parsing works correctly
5. ✅ Bus scanning functions properly
6. ✅ Data exchange (DP) operations work reliably
7. ✅ Comprehensive documentation is complete
8. ✅ Successfully tested with real PROFIBUS devices
9. ✅ Claude Desktop integration works seamlessly
10. ✅ Performance targets are met
11. ✅ Security best practices are implemented

## Timeline Estimate

- **Phase 1** (Setup): 1-2 days
- **Phase 2** (Python Server): 7-10 days
- **Phase 3** (NPM Server): 4-6 days
- **Phase 4** (Mock Slave): 3-5 days
- **Phase 5** (Testing): 4-6 days
- **Phase 6** (Documentation): 2-3 days

**Total Estimated Time**: 21-32 days

## References

- [PROFIBUS Specification](https://www.profibus.com/download/profibus-specification/)
- [PI (PROFIBUS & PROFINET International)](https://www.profibus.com/)
- [GSD File Specification](https://www.profibus.com/download/gsd-specification/)
- [IEC 61158 Standard](https://webstore.iec.ch/publication/4637)
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [MODBUS-Project Reference](../../MODBUS-Project/)
- [Siemens PROFIBUS Documentation](https://support.industry.siemens.com/)

---

**Document Version**: 1.0  
**Created**: 2025-11-28  
**Last Updated**: 2025-11-28  
**Status**: Planning Phase
