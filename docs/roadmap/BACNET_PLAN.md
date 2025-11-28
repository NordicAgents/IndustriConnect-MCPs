# BACnet/IP MCP Server - Implementation Plan
## Building Automation Protocol

## Project Overview

This plan outlines the development of a **Model Context Protocol (MCP) server for BACnet/IP** - the industry-standard protocol for building automation and control systems. The implementation will follow the proven architecture from the MODBUS-Project, enabling AI agents and MCP-compatible applications to communicate with BACnet devices (HVAC controllers, lighting systems, access control, fire detection, and building management systems).

## Project Goals

- Create a production-ready MCP server for BACnet/IP protocol
- Support both Python and NPM/TypeScript implementations
- Provide comprehensive tooling for device/object discovery, property operations, and monitoring
- Include a mock BACnet device for testing and development
- Maintain consistency with the MODBUS-Project architecture and patterns
- Enable seamless AI agent integration with building automation systems
- Support BACnet services (ReadProperty, WriteProperty, COV, Alarms, Schedules, Trends)

## Repository Structure

```
BACnet-Project/
├── .gitignore                    # Combined ignore patterns (Python, Node, IDE)
├── README.md                     # Main project documentation
├── bacnet-python/                # Python MCP server implementation
│   ├── .gitignore
│   ├── .python-version
│   ├── README.md
│   ├── pyproject.toml           # uv/pip configuration
│   ├── uv.lock
│   └── src/
│       └── bacnet_mcp/
│           ├── __init__.py
│           ├── cli.py           # Entry point (bacnet-mcp command)
│           ├── server.py        # MCP server implementation
│           ├── tools.py         # BACnet tool definitions
│           └── bacnet_client.py # BACnet client wrapper
├── bacnet-npm/                  # NPM/TypeScript MCP server
│   ├── .gitignore
│   ├── README.md
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── mcp-config-example.json
│   └── src/
│       └── index.ts             # Main MCP server + tools
└── bacnet-mock-device/          # Mock BACnet device for testing
    ├── .gitignore
    ├── README.md
    ├── pyproject.toml
    └── bacnet_mock_device.py    # Simulated BACnet device
```

## Technology Stack

### Python Implementation (bacnet-python)
- **Python**: 3.10+
- **Package Manager**: uv (modern, fast dependency manager)
- **MCP SDK**: `mcp[cli]>=1.6.0`
- **BACnet Protocol**: `BAC0>=23.09.01` or `bacpypes3>=0.0.80`
- **Environment**: `python-dotenv>=1.1.0`
- **Build System**: hatchling

### NPM Implementation (bacnet-npm)
- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.6+
- **MCP SDK**: `@modelcontextprotocol/sdk@^1.2.0`
- **BACnet Protocol**: `node-bacnet@^0.2.4` or `bacstack`
- **Environment**: `dotenv@^16.4.5`
- **Build**: TypeScript compiler

### Mock Device (bacnet-mock-device)
- **Python**: 3.10+
- **Framework**: Custom BACnet device implementation using BAC0 or bacpypes3
- **Package Manager**: uv

## Core Features & Tools

### 1. Device Discovery & Management
- **discover_devices**: Who-Is broadcast to discover BACnet devices
  - Returns: device instance, vendor, model, description
- **get_device_info**: Read device object properties
- **get_object_list**: Get all objects from a device
- **scan_network**: Scan network for BACnet devices

### 2. Object Discovery
- **discover_objects**: Discover all objects in a device
  - Returns: object type, instance, name, description
- **get_object_types**: Get all object types supported by device
- **find_objects_by_type**: Find all objects of specific type
  - Types: Analog Input/Output/Value, Binary Input/Output/Value, Multi-state, etc.

### 3. Property Operations
- **read_property**: Read single property from object
  - Parameters: device_id, object_type, object_instance, property_id
- **read_property_multiple**: Read multiple properties from multiple objects
- **write_property**: Write property value
  - Parameters: device_id, object_type, object_instance, property_id, value, priority
- **read_all_properties**: Read all properties of an object

### 4. Change of Value (COV) Subscriptions
- **subscribe_cov**: Subscribe to COV notifications
  - Parameters: device_id, object_type, object_instance, lifetime
- **unsubscribe_cov**: Cancel COV subscription
- **get_cov_subscriptions**: List active subscriptions
- **handle_cov_notification**: Receive and process COV notifications

### 5. Alarm & Event Management
- **get_alarm_summary**: Get alarm summary from device
- **get_event_information**: Read event enrollment information
- **acknowledge_alarm**: Acknowledge alarm
- **get_event_log**: Read event log entries

### 6. Scheduling
- **read_schedule**: Read schedule object
- **write_schedule**: Write schedule
- **get_effective_period**: Get current effective period
- **override_schedule**: Override schedule temporarily

### 7. Trending
- **read_trend_log**: Read trend log buffer
- **read_trend_log_multiple**: Read multiple log records
- **get_trend_log_info**: Get trend log configuration

### 8. Time Synchronization
- **sync_time**: Synchronize device time with master
- **get_device_time**: Read device time
- **set_utc_offset**: Set UTC time offset

### 9. Object Map System
- **list_objects**: List all configured objects from map
- **read_object_by_alias**: Read by alias name
- **write_object_by_alias**: Write by alias name
- Object configuration file format (JSON):
```json
{
  "ZoneTemp_101": {
    "device": 12345,
    "object_type": "analog-input",
    "object_instance": 1,
    "description": "Zone 101 temperature sensor",
    "unit": "degrees-fahrenheit",
    "cov_increment": 0.5
  },
  "AHU1_Status": {
    "device": 12345,
    "object_type": "binary-value",
    "object_instance": 100,
    "description": "AHU-1 fan status",
    "alarm_state": "normal"
  },
  "VAV_101_Damper": {
    "device": 12345,
    "object_type": "analog-output",
    "object_instance": 50,
    "description": "VAV-101 damper position",
    "unit": "percent",
    "min": 0,
    "max": 100,
    "priority": 8
  }
}
```

### 10. File Operations
- **read_file**: Read file from BACnet device
- **write_file**: Write file to BACnet device
- **get_file_list**: List files on device
- **delete_file**: Delete file from device

### 11. Diagnostics & Health
- **ping**: Connection health check
- **who_is**: Send Who-Is request
- **i_am**: Response to Who-Is
- **reinitialize_device**: Reinitialize device
- **get_network_port_info**: Get network port configuration

## Environment Variables

```bash
# Network Settings
BACNET_INTERFACE=0.0.0.0         # Local IP interface (default: 0.0.0.0)
BACNET_PORT=47808                # BACnet/IP port (default: 47808 UDP)
BACNET_BROADCAST_ADDRESS=255.255.255.255  # Broadcast address

# Device Settings
BACNET_DEVICE_INSTANCE=1234      # Local device instance (default: 1234)
BACNET_DEVICE_NAME=BACnetMCPServer  # Local device name
BACNET_VENDOR_ID=999             # Vendor ID (default: 999)
BACNET_SEGMENTATION=segmented-both  # Segmentation support

# Protocol Settings
BACNET_TIMEOUT=10000             # Request timeout in milliseconds (default: 10000)
BACNET_MAX_RETRIES=3             # Retry attempts (default: 3)
BACNET_APDU_TIMEOUT=6000         # APDU timeout in ms (default: 6000)
BACNET_NUMBER_OF_APDU_RETRIES=3  # APDU retries (default: 3)

# COV Settings
BACNET_COV_LIFETIME=300          # Default COV subscription lifetime in seconds (default: 300)
BACNET_COV_RESUBSCRIBE=true      # Auto-resubscribe COV (default: true)

# Discovery Settings
BACNET_DISCOVERY_TIMEOUT=5000    # Device discovery timeout in ms (default: 5000)
BACNET_WHO_IS_INTERVAL=60000     # Periodic Who-Is interval in ms (0 = disabled)

# Priority Array
BACNET_DEFAULT_PRIORITY=8        # Default write priority 1-16 (default: 8)

# Security Settings
BACNET_WRITES_ENABLED=true       # Allow write operations (default: true)
BACNET_CONTROL_CMDS_ENABLED=false  # Allow control commands (default: false)

# Object Map
OBJECT_MAP_FILE=/path/to/objects.json  # Optional object configuration file

# Debugging
BACNET_DEBUG=false               # Enable debug logging (default: false)
BACNET_LOG_PACKETS=false         # Log BACnet packets (default: false)
```

## Implementation Phases

### Phase 1: Project Setup & Foundation ✅
- [ ] Create directory structure
- [ ] Set up .gitignore files (Python, Node, IDE files)
- [ ] Initialize Python project with uv
  - [ ] Create pyproject.toml
  - [ ] Set Python version (.python-version file)
  - [ ] Configure dependencies (BAC0/bacpypes3, mcp, dotenv)
- [ ] Initialize NPM project
  - [ ] Create package.json with bin entry
  - [ ] Configure TypeScript (tsconfig.json)
  - [ ] Add dependencies (MCP SDK, node-bacnet)
- [ ] Create main README.md

### Phase 2: Python MCP Server (bacnet-python)
- [ ] Core infrastructure
  - [ ] Set up MCP server scaffold (server.py)
  - [ ] Create BACnet client wrapper (bacnet_client.py)
  - [ ] Implement BACnet device initialization
  - [ ] Add environment variable configuration
  - [ ] Create CLI entry point (cli.py)
- [ ] Device discovery & management
  - [ ] discover_devices tool (Who-Is)
  - [ ] get_device_info tool
  - [ ] get_object_list tool
  - [ ] scan_network tool
- [ ] Object discovery
  - [ ] discover_objects tool
  - [ ] get_object_types tool
  - [ ] find_objects_by_type tool
- [ ] Property operations
  - [ ] read_property tool
  - [ ] read_property_multiple tool
  - [ ] write_property tool
  - [ ] read_all_properties tool
- [ ] COV subscriptions
  - [ ] subscribe_cov tool
  - [ ] unsubscribe_cov tool
  - [ ] get_cov_subscriptions tool
  - [ ] COV notification handler
- [ ] Alarm & event management
  - [ ] get_alarm_summary tool
  - [ ] get_event_information tool
  - [ ] acknowledge_alarm tool
  - [ ] get_event_log tool
- [ ] Scheduling
  - [ ] read_schedule tool
  - [ ] write_schedule tool
  - [ ] get_effective_period tool
  - [ ] override_schedule tool
- [ ] Trending
  - [ ] read_trend_log tool
  - [ ] read_trend_log_multiple tool
  - [ ] get_trend_log_info tool
- [ ] Time synchronization
  - [ ] sync_time tool
  - [ ] get_device_time tool
  - [ ] set_utc_offset tool
- [ ] Object map system
  - [ ] Object file parser (JSON)
  - [ ] list_objects tool
  - [ ] read_object_by_alias tool
  - [ ] write_object_by_alias tool
- [ ] File operations
  - [ ] read_file tool
  - [ ] write_file tool
  - [ ] get_file_list tool
  - [ ] delete_file tool
- [ ] Diagnostics & health
  - [ ] ping tool
  - [ ] who_is tool
  - [ ] reinitialize_device tool
  - [ ] get_network_port_info tool
- [ ] Error handling & validation
  - [ ] Unified response format: `{success, data, error, meta}`
  - [ ] Input validation for all tools
  - [ ] BACnet error code translation
  - [ ] Comprehensive error messages
- [ ] Documentation
  - [ ] README.md with installation, configuration, examples
  - [ ] Tool documentation with schemas
  - [ ] Object mapping guide
  - [ ] COV subscription guide
  - [ ] MCP client configuration examples

### Phase 3: NPM/TypeScript MCP Server (bacnet-npm)
- [ ] Port Python implementation to TypeScript
  - [ ] MCP server setup
  - [ ] BACnet client implementation
  - [ ] Device initialization
  - [ ] Environment configuration
- [ ] Implement all tools (matching Python API)
  - [ ] Device discovery & management
  - [ ] Object discovery
  - [ ] Property operations
  - [ ] COV subscriptions
  - [ ] Alarm & event management
  - [ ] Scheduling
  - [ ] Trending
  - [ ] Time synchronization
  - [ ] Object map system
  - [ ] File operations
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

### Phase 4: Mock BACnet Device (bacnet-mock-device)
- [ ] Device implementation
  - [ ] BACnet device protocol stack
  - [ ] Object database
  - [ ] Property handling
  - [ ] Configurable device instance
- [ ] Object types
  - [ ] Analog Input/Output/Value objects
  - [ ] Binary Input/Output/Value objects
  - [ ] Multi-state Input/Output/Value objects
  - [ ] Schedule objects
  - [ ] Trend log objects
  - [ ] Notification class objects
- [ ] Test data
  - [ ] Pre-configured objects
  - [ ] Simulated sensor/actuator data
  - [ ] Various data types
  - [ ] Realistic building scenarios (HVAC, lighting, etc.)
- [ ] Features
  - [ ] UDP/IP communication (port 47808)
  - [ ] Console logging for all operations
  - [ ] CLI controls for changing values
  - [ ] Auto-updating object values
  - [ ] COV notification support
  - [ ] Alarm generation
  - [ ] Schedule execution
- [ ] Documentation
  - [ ] README.md with device configuration
  - [ ] Object database documentation
  - [ ] Usage examples
  - [ ] Integration testing guide

### Phase 5: Testing & Integration
- [ ] Unit tests
  - [ ] Python tool tests
  - [ ] TypeScript tool tests
  - [ ] Mock device tests
- [ ] Integration tests
  - [ ] Python MCP server ↔ Mock device
  - [ ] NPM MCP server ↔ Mock device
  - [ ] Tool output consistency between Python/NPM
  - [ ] Multi-device scenarios
- [ ] Real hardware testing
  - [ ] Test with real BACnet controllers
  - [ ] Test with HVAC systems
  - [ ] Verify all tools work correctly
  - [ ] Performance benchmarking
  - [ ] COV notification handling
- [ ] MCP client testing
  - [ ] Claude Desktop integration
  - [ ] MCP Inspector testing
  - [ ] Multi-tool workflow tests

### Phase 6: Documentation & Polish
- [ ] Main README.md
  - [ ] Project overview
  - [ ] Quick start guide
  - [ ] Architecture overview
  - [ ] BACnet protocol overview
  - [ ] Building automation use cases
  - [ ] Feature comparison with MODBUS-Project
- [ ] Individual component READMEs
  - [ ] Complete API documentation
  - [ ] Environment variable reference
  - [ ] Troubleshooting guides
  - [ ] Object mapping guide
  - [ ] COV subscription best practices
  - [ ] Example use cases
- [ ] MCP configuration examples
  - [ ] Claude Desktop configs (Python & NPM)
  - [ ] Other MCP client examples
- [ ] Object map examples
  - [ ] Sample object files for common scenarios
  - [ ] Naming conventions
  - [ ] Best practices
- [ ] Video/GIF demonstrations
  - [ ] Setup and device discovery
  - [ ] Common operations
  - [ ] AI agent interaction examples

## Code Structure Details

### Python Server Architecture

```python
# src/bacnet_mcp/server.py
class BACnetMCPServer:
    def __init__(self):
        self.client = BACnetClient()
        self.object_map = ObjectMap()
        
    async def run(self):
        # Initialize MCP server
        # Register all tools
        # Start stdio transport

# src/bacnet_mcp/bacnet_client.py
import BAC0

class BACnetClient:
    def __init__(self, ip='0.0.0.0', device_id=1234):
        self.bacnet = BAC0.connect(ip=ip, device_id=device_id)
        
    def discover_devices(self):
        # Who-Is broadcast
        
    def read_property(self, device_id, obj_type, obj_instance, prop_id):
        # Read property from object
        
    def write_property(self, device_id, obj_type, obj_instance, prop_id, value, priority):
        # Write property to object
        
    def subscribe_cov(self, device_id, obj_type, obj_instance, lifetime):
        # Subscribe to COV notifications
```

### NPM Server Architecture

```typescript
// src/index.ts
import bacnet from 'node-bacnet';

class BACnetMCPServer {
  private client: any;
  private objectMap: ObjectMap;
  
  async run() {
    // Initialize MCP server
    // Register tools
    // Start stdio transport
  }
}

// BACnet client wrapper
class BACnetClient {
  private bacnet: any;
  
  constructor() {
    this.bacnet = bacnet();
  }
  
  async discoverDevices(): Promise<Device[]> { }
  async readProperty(deviceId: number, objType: string, objInstance: number, propId: string): Promise<any> { }
  async writeProperty(deviceId: number, objType: string, objInstance: number, propId: string, value: any, priority: number): Promise<void> { }
  async subscribeCOV(deviceId: number, objType: string, objInstance: number, lifetime: number): Promise<void> { }
}
```

## Tool Response Format

All tools return a consistent format:

```json
{
  "success": true,
  "data": {
    "device": 12345,
    "object_type": "analog-input",
    "object_instance": 1,
    "property": "present-value",
    "value": 72.5,
    "units": "degrees-fahrenheit",
    "reliability": "no-fault-detected"
  },
  "error": null,
  "meta": {
    "timestamp": "2025-11-28T19:55:00Z",
    "device_name": "VAV-101",
    "object_name": "Zone Temperature",
    "execution_time_ms": 35
  }
}
```

## Example Tool Calls

### Discover Devices
```json
{
  "tool": "discover_devices",
  "parameters": {
    "timeout": 5000
  }
}
```

### Read Property
```json
{
  "tool": "read_property",
  "parameters": {
    "device_id": 12345,
    "object_type": "analog-input",
    "object_instance": 1,
    "property_id": "present-value"
  }
}
```

### Write Property
```json
{
  "tool": "write_property",
  "parameters": {
    "device_id": 12345,
    "object_type": "analog-output",
    "object_instance": 50,
    "property_id": "present-value",
    "value": 75.0,
    "priority": 8
  }
}
```

### Subscribe COV
```json
{
  "tool": "subscribe_cov",
  "parameters": {
    "device_id": 12345,
    "object_type": "analog-input",
    "object_instance": 1,
    "lifetime": 300
  }
}
```

### Get Alarm Summary
```json
{
  "tool": "get_alarm_summary",
  "parameters": {
    "device_id": 12345
  }
}
```

### Using Object Map (Alias)
```json
{
  "tool": "read_object_by_alias",
  "parameters": {
    "alias": "ZoneTemp_101"
  }
}
```

## Dependencies & Requirements

### System Requirements
- **Python**: 3.10 or higher
- **Node.js**: 18 or higher (for NPM version)
- **uv**: For Python dependency management
- **Network Access**: UDP port 47808 (BACnet/IP)

### Python Dependencies
```toml
dependencies = [
    "mcp[cli]>=1.6.0",
    "BAC0>=23.09.01",
    "python-dotenv>=1.1.0",
]
```

### NPM Dependencies
```json
"dependencies": {
  "@modelcontextprotocol/sdk": "^1.2.0",
  "dotenv": "^16.4.5",
  "node-bacnet": "^0.2.4"
}
```

## Security Considerations

1. **Write Protection**: Default `BACNET_WRITES_ENABLED=true` with option to disable
2. **Control Commands**: `BACNET_CONTROL_CMDS_ENABLED=false` by default
3. **Input Validation**: All tool inputs validated before BACnet operations
4. **Priority Management**: Enforce proper write priority levels
5. **Network Isolation**: Recommend dedicated BAS network
6. **Audit Logging**: Optional logging of all write and control operations
7. **Device Authentication**: Support for BACnet/SC (Secure Connect) - Planned

## Testing Strategy

### Mock Device Test Cases
1. **Device Discovery**: Who-Is/I-Am exchanges
2. **Property Operations**: Read/write various properties
3. **COV Subscriptions**: Subscribe, receive notifications, unsubscribe
4. **Alarm Handling**: Generate and acknowledge alarms
5. **Scheduling**: Read and write schedules
6. **Trending**: Log and retrieve trend data
7. **Error Handling**: Invalid objects, properties, values
8. **Object Map System**: Alias resolution, read/write by alias

### Real Hardware Testing
- Test with BACnet controllers (HVAC, lighting, access control)
- Test with building management systems
- Verify data integrity
- Performance testing (latency, throughput)
- Multi-device scenarios
- COV notification handling
- Priority array behavior

## Performance Targets

- **Device Discovery**: < 5 seconds
- **Property Read**: < 100ms
- **Property Write**: < 150ms
- **COV Subscription**: < 200ms
- **COV Notification**: < 50ms (from event to receipt)
- **Read Property Multiple**: < 300ms (10 properties)

## Troubleshooting Guide

Common issues and solutions to document:

1. **Discovery Failed**
   - Verify UDP port 47808 is open
   - Check broadcast address configuration
   - Ensure devices are on same network
   - Check firewall settings

2. **No Response from Device**
   - Verify device instance number
   - Check network connectivity
   - Ensure device supports BACnet/IP
   - Check APDU timeout

3. **Write Failed**
   - Check write priority (1-16)
   - Verify property is writable
   - Check for relinquish-default
   - Review priority array

4. **COV Not Working**
   - Verify object supports COV
   - Check COV increment configuration
   - Ensure lifetime is sufficient
   - Monitor subscription renewals

5. **Segmentation Issues**
   - Check segmentation support
   - Verify APDU size limits
   - Use Read Property Multiple

## BACnet Protocol Details

### Supported Object Types
- **Analog**: Input, Output, Value
- **Binary**: Input, Output, Value
- **Multi-state**: Input, Output, Value
- **Schedule**: Weekly/calendar schedules
- **Trend Log**: Data logging
- **Notification Class**: Alarm management
- **Device**: Device object (required)

### Supported Services
- **Data Sharing**: ReadProperty, WriteProperty, ReadPropertyMultiple
- **Alarm & Event**: GetAlarmSummary, GetEventInformation, AcknowledgeAlarm
- **COV**: SubscribeCOV, UnsubscribedCOV
- **Time**: TimeSynchronization
- **Device Management**: Who-Is, I-Am, ReinitializeDevice
- **File Access**: AtomicReadFile, AtomicWriteFile

### Priority Array
1. Manual-Life Safety (highest)
2-5: Automatic-Life Safety, Available, Critical Equipment Control
6: Minimum On/Off
7: Available
8: Manual Operator (default for manual)
9-15: Available
16: Available (lowest - often used for schedules)

## Future Enhancements

- [ ] BACnet/SC (Secure Connect) support
- [ ] BACnet MS/TP (serial) support
- [ ] Advanced scheduling with exceptions
- [ ] Energy management integration
- [ ] Fault detection and diagnostics
- [ ] Web UI for building visualization
- [ ] Integration with BIM systems
- [ ] Historical data analytics
- [ ] Multi-network routing
- [ ] Foreign device registration

## Success Criteria

This project will be considered complete when:

1. ✅ Both Python and NPM servers are fully functional
2. ✅ All core tools are implemented and tested
3. ✅ Mock device provides realistic testing environment
4. ✅ Device and object discovery work reliably
5. ✅ Property read/write operations function correctly
6. ✅ COV subscriptions work properly
7. ✅ Comprehensive documentation is complete
8. ✅ Successfully tested with real BACnet devices
9. ✅ Claude Desktop integration works seamlessly
10. ✅ Performance targets are met
11. ✅ Security best practices are implemented

## Timeline Estimate

- **Phase 1** (Setup): 1-2 days
- **Phase 2** (Python Server): 8-12 days
- **Phase 3** (NPM Server): 5-7 days
- **Phase 4** (Mock Device): 4-6 days
- **Phase 5** (Testing): 5-7 days
- **Phase 6** (Documentation): 2-3 days

**Total Estimated Time**: 25-37 days

## References

- [BACnet Standard (ASHRAE 135)](https://www.ashrae.org/technical-resources/bookstore/bacnet)
- [BACnet International](http://www.bacnetinternational.org/)
- [BAC0 Documentation](https://bac0.readthedocs.io/)
- [bacpypes Documentation](https://bacpypes.readthedocs.io/)
- [node-bacnet Documentation](https://www.npmjs.com/package/node-bacnet)
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [MODBUS-Project Reference](../../MODBUS-Project/)

---

**Document Version**: 1.0  
**Created**: 2025-11-28  
**Last Updated**: 2025-11-28  
**Status**: Planning Phase
