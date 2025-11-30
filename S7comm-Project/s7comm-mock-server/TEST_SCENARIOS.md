# S7comm Mock Server - Test Scenarios

This document outlines simple test scenarios for validating the S7comm mock server functionality using the MCP server tools.

## Prerequisites

1. Start the mock server:
   ```bash
   cd s7comm-mock-server
   uv sync
   uv run s7comm-mock-server
   ```

2. Configure the MCP client to connect to the mock server:
   ```bash
   export S7_HOST=127.0.0.1
   export S7_PORT=1102
   export S7_RACK=0
   export S7_SLOT=2
   ```

## Memory Map

### DB1 (Telemetry Data Block)
- **Offset 0**: Motor Speed (REAL) - Updates with random variation around base speed
- **Offset 4**: Motor Torque (REAL) - Static value: 42.0
- **Offset 8**: Flow Rate (REAL) - Static value: 22.5
- **Offset 12**: Batch Counter (DINT) - Static value: 12345678
- **Offset 16**: Temperature (REAL) - Updates with random variation around base temp

### DB2 (Alarms & Configuration)
- **Offset 0, Bit 0**: Alarm bit (BOOL) - Set to True
- **Offset 2**: Status string (STRING) - "OK"

### Inputs (PE)
- **Byte 0, Bit 0**: Sensor 1 - Toggles periodically
- **Byte 0, Bit 1**: Sensor 2 - Toggles periodically

### Outputs (PA)
- **Byte 0, Bit 0**: Pump command (BOOL) - Writable, initial: False

### Markers (M)
- **Byte 0, Bit 0**: System marker - Set to True

---

## Test Scenario 1: Basic Connection & System Info

**Objective**: Verify connection to mock server and read system information.

### Steps:
1. **Check connection status**
   ```json
   { "tool": "get_connection_status", "parameters": {} }
   ```
   Expected: Connection established, session active

2. **Read PLC information**
   ```json
   { "tool": "read_plc_info", "parameters": {} }
   ```
   Expected: Returns PLC type, firmware version, etc.

3. **Read CPU state**
   ```json
   { "tool": "read_cpu_state", "parameters": {} }
   ```
   Expected: `S7CpuStatusRun`

4. **Read system time**
   ```json
   { "tool": "read_system_time", "parameters": {} }
   ```
   Expected: Current timestamp from PLC

5. **Ping test**
   ```json
   { "tool": "ping", "parameters": {} }
   ```
   Expected: Success response with connection details

---

## Test Scenario 2: Reading Telemetry Data

**Objective**: Read all telemetry values from DB1.

### Steps:
1. **Read Motor Speed** (REAL at DB1, offset 0)
   ```json
   { "tool": "read_db_typed", "parameters": { "db_number": 1, "start_offset": 0, "data_type": "REAL" } }
   ```
   Expected: Value around 1450.0 (varies ±10 due to random updates)

2. **Read Motor Torque** (REAL at DB1, offset 4)
   ```json
   { "tool": "read_db_typed", "parameters": { "db_number": 1, "start_offset": 4, "data_type": "REAL" } }
   ```
   Expected: `42.0`

3. **Read Flow Rate** (REAL at DB1, offset 8)
   ```json
   { "tool": "read_db_typed", "parameters": { "db_number": 1, "start_offset": 8, "data_type": "REAL" } }
   ```
   Expected: `22.5`

4. **Read Batch Counter** (DINT at DB1, offset 12)
   ```json
   { "tool": "read_db_typed", "parameters": { "db_number": 1, "start_offset": 12, "data_type": "DINT" } }
   ```
   Expected: `12345678`

5. **Read Temperature** (REAL at DB1, offset 16)
   ```json
   { "tool": "read_db_typed", "parameters": { "db_number": 1, "start_offset": 16, "data_type": "REAL" } }
   ```
   Expected: Value around 68.0 (varies ±2.5 due to random updates)

6. **Read raw bytes** (DB1, first 20 bytes)
   ```json
   { "tool": "read_db", "parameters": { "db_number": 1, "start_offset": 0, "size": 20 } }
   ```
   Expected: Hex bytes containing all the above values

---

## Test Scenario 3: Reading Alarms & Status

**Objective**: Read alarm bits and status strings from DB2.

### Steps:
1. **Read Alarm Bit** (BOOL at DB2, byte 0, bit 0)
   ```json
   { "tool": "read_db_typed", "parameters": { "db_number": 2, "start_offset": 0, "data_type": "BOOL", "bit_index": 0 } }
   ```
   Expected: `true`

2. **Read Status String** (STRING at DB2, offset 2)
   ```json
   { "tool": "read_db_typed", "parameters": { "db_number": 2, "start_offset": 2, "data_type": "STRING", "string_length": 30 } }
   ```
   Expected: `"OK"`

---

## Test Scenario 4: Reading Inputs & Outputs

**Objective**: Read process inputs and outputs.

### Steps:
1. **Read Inputs** (PE area, byte 0)
   ```json
   { "tool": "read_input", "parameters": { "start_byte": 0, "size": 1 } }
   ```
   Expected: Byte value with bits 0 and 1 toggling

2. **Read Input Bit 0** (Sensor 1)
   ```json
   { "tool": "read_db_typed", "parameters": { "area": "input", "byte": 0, "bit": 0, "data_type": "BOOL" } }
   ```
   Expected: Boolean value (changes periodically)

3. **Read Outputs** (PA area, byte 0)
   ```json
   { "tool": "read_output", "parameters": { "start_byte": 0, "size": 1 } }
   ```
   Expected: Byte value (bit 0 should be False initially)

4. **Read Pump Command** (Output bit 0)
   ```json
   { "tool": "read_db_typed", "parameters": { "area": "output", "byte": 0, "bit": 0, "data_type": "BOOL" } }
   ```
   Expected: `false`

---

## Test Scenario 5: Writing Values

**Objective**: Write values to outputs and verify changes.

### Steps:
1. **Write Pump Command** (Set output bit 0 to True)
   ```json
   { "tool": "write_output", "parameters": { "start_byte": 0, "value": true, "data_type": "BOOL", "bit_index": 0 } }
   ```
   Expected: Success

2. **Verify Pump Command** (Read back)
   ```json
   { "tool": "read_output", "parameters": { "start_byte": 0, "size": 1 } }
   ```
   Expected: Bit 0 should now be True

3. **Write to DB1** (Update Flow Rate to 25.0)
   ```json
   { "tool": "write_db", "parameters": { "db_number": 1, "start_offset": 8, "value": 25.0, "data_type": "REAL" } }
   ```
   Expected: Success

4. **Verify Flow Rate** (Read back)
   ```json
   { "tool": "read_db_typed", "parameters": { "db_number": 1, "start_offset": 8, "data_type": "REAL" } }
   ```
   Expected: `25.0`

---

## Test Scenario 6: Monitoring Dynamic Values

**Objective**: Observe values that change over time.

### Steps:
1. **Read Motor Speed** (initial)
   ```json
   { "tool": "read_db_typed", "parameters": { "db_number": 1, "start_offset": 0, "data_type": "REAL" } }
   ```
   Note the value

2. **Wait 2-3 seconds** (mock server updates every 1 second by default)

3. **Read Motor Speed** (again)
   ```json
   { "tool": "read_db_typed", "parameters": { "db_number": 1, "start_offset": 0, "data_type": "REAL" } }
   ```
   Expected: Value should differ from step 1 (within ±10 range)

4. **Read Temperature** (multiple times)
   - Read temperature 3-4 times with 1-2 second intervals
   - Expected: Values vary around 68.0 ± 2.5

5. **Read Input Bits** (monitor toggling)
   - Read input bit 0 and bit 1 multiple times
   - Expected: Values toggle periodically

---

## Test Scenario 7: Batch Operations

**Objective**: Read multiple values in a single request.

### Steps:
1. **Batch Read Multiple Variables**
   ```json
   {
     "tool": "read_multiple_vars",
     "parameters": {
       "variables": [
         { "area": "db", "db_number": 1, "start_offset": 0, "data_type": "REAL" },
         { "area": "db", "db_number": 1, "start_offset": 4, "data_type": "REAL" },
         { "area": "db", "db_number": 1, "start_offset": 8, "data_type": "REAL" },
         { "area": "db", "db_number": 1, "start_offset": 16, "data_type": "REAL" }
       ]
     }
   }
   ```
   Expected: Returns all four values (Motor Speed, Torque, Flow, Temperature)

2. **Batch Write Multiple Variables**
   ```json
   {
     "tool": "write_multiple_vars",
     "parameters": {
       "variables": [
         { "area": "db", "db_number": 1, "start_offset": 8, "value": 30.0, "data_type": "REAL" },
         { "area": "output", "start_byte": 0, "value": true, "data_type": "BOOL", "bit_index": 0 }
       ]
     }
   }
   ```
   Expected: Success for both writes

---

## Test Scenario 8: Reading Markers

**Objective**: Read marker memory area.

### Steps:
1. **Read Markers** (M area, byte 0)
   ```json
   { "tool": "read_marker", "parameters": { "start_byte": 0, "size": 1 } }
   ```
   Expected: Byte value with bit 0 set to True

2. **Read Marker Bit 0**
   ```json
   { "tool": "read_db_typed", "parameters": { "area": "marker", "byte": 0, "bit": 0, "data_type": "BOOL" } }
   ```
   Expected: `true`

---

## Test Scenario 9: Error Handling

**Objective**: Verify proper error handling for invalid requests.

### Steps:
1. **Read from non-existent DB**
   ```json
   { "tool": "read_db", "parameters": { "db_number": 999, "start_offset": 0, "size": 10 } }
   ```
   Expected: Error response

2. **Read with invalid offset** (beyond DB size)
   ```json
   { "tool": "read_db", "parameters": { "db_number": 1, "start_offset": 1000, "size": 10 } }
   ```
   Expected: Error or empty data

3. **Read with invalid data type**
   ```json
   { "tool": "read_db_typed", "parameters": { "db_number": 1, "start_offset": 0, "data_type": "INVALID_TYPE" } }
   ```
   Expected: Error response

---

## Test Scenario 10: Tag System (if configured)

**Objective**: Test tag-based access if tag map is configured.

### Steps:
1. **List Tags**
   ```json
   { "tool": "list_tags", "parameters": {} }
   ```
   Expected: Returns configured tags (if any)

2. **Read Tag** (if tags exist)
   ```json
   { "tool": "read_tag", "parameters": { "name": "MotorSpeed" } }
   ```
   Expected: Returns value from DB1 offset 0

3. **Write Tag** (if tags exist)
   ```json
   { "tool": "write_tag", "parameters": { "name": "MotorSpeed", "value": 1500.0 } }
   ```
   Expected: Success

---

## Expected Behavior Summary

- **Static Values**: Motor Torque (42.0), Flow Rate (22.5), Batch Counter (12345678) remain constant
- **Dynamic Values**: Motor Speed and Temperature update every 1 second with random variation
- **Toggling Bits**: Input bits 0 and 1 toggle periodically
- **Writable Areas**: Outputs and DB values can be written and read back
- **System Info**: CPU state should be RUN, system time should be current

## Notes

- The mock server updates values every 1 second by default (configurable via `MOCK_S7_UPDATE_INTERVAL`)
- Motor speed varies around the base value (default 1450.0) with ±10 range
- Temperature varies around the base value (default 68.0) with ±2.5 range
- Input bits toggle based on a phase counter that increments every update cycle

