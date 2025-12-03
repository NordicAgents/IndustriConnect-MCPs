# IndustriConnect MCP Suite – Whitepaper

## 1. Introduction

Industrial automation systems—PLCs, RTUs, field devices, gateways—speak a rich set of domain‑specific protocols (Modbus, OPC UA, MQTT/Sparkplug B, BACnet, DNP3, EtherNet/IP, PROFIBUS, PROFINET, S7, and others). Modern AI assistants and tools, however, expect structured APIs, clear schemas, and predictable error handling.

The IndustriConnect MCP suite bridges that gap. It provides:

- **Protocol‑aware MCP servers** for major industrial protocols
- **Realistic mock devices/servers** for safe local testing
- **A common tool and response model** that fits naturally into the Model Context Protocol (MCP) ecosystem

This document explains the motivation, architecture, and design principles of the suite.

---

## 2. Motivation and Problem Space

### 2.1 Operational Technology vs. AI Assistants

Operational Technology (OT) environments are:

- **Heterogeneous** – vendors and protocols vary widely (Siemens S7, Rockwell EtherNet/IP, Modbus, etc.)
- **Safety‑critical** – mistakes can impact physical processes, not just data
- **Constrained and segmented** – networks are often isolated by design

Meanwhile, AI assistants:

- Excel at **reasoning over structured data** and **orchestrating workflows**
- Prefer **simple, self‑describing APIs** with consistent semantics
- Benefit from **mockable** environments for development and testing

Bridging these worlds requires tooling that:

- Speaks industrial protocols reliably
- Presents a stable, consistent tool interface to AI clients
- Encourages safe, mock‑first development practices

### 2.2 Why MCP?

The Model Context Protocol (MCP) is:

- **Transport‑agnostic** (often stdio for local tools)
- **Schema‑driven** (tools and types are discoverable)
- **Client‑neutral** (works with Claude Desktop, mcp-manager-ui, and other MCP runners)

MCP provides the “language” that AI assistants understand. The IndustriConnect MCP servers act as translators between MCP and industrial protocols.

---

## 3. High‑Level Architecture

At a high level, the ecosystem looks like this:

```text
┌───────────────────────────┐
│   MCP Client / UI         │
│   (Claude, mcp-manager-ui)│
└─────────────┬─────────────┘
              │ stdio / MCP
              ▼
┌───────────────────────────┐
│  Protocol MCP Server      │
│  (Modbus, OPC UA, S7, …)  │
└─────────────┬─────────────┘
              │ protocol library
              ▼
┌───────────────────────────┐
│ Real Device or Mock Server│
│ (PLC, gateway, simulator) │
└───────────────────────────┘
```

Key layers:

- **MCP Client / UI** – e.g., Claude Desktop or `mcp-manager-ui`, which discovers tools and issues `call_tool` requests.
- **Protocol MCP Server** – a Python process that:
  - Translates MCP tool calls into protocol operations
  - Uses libraries like `python-snap7`, `pycomm3`, `opcua`, `paho-mqtt`, etc.
  - Returns structured `{ success, data, error, meta }` responses
- **Device / Mock** – the actual industrial equipment or a simulated equivalent.

Each protocol project in this repo hosts one MCP server and one or more mocks.

---

## 4. Protocol Modules

Each protocol module follows the same pattern: a Python MCP server, plus a mock implementation that simulates realistic behavior.

### 4.1 Modbus

- **Project**: `MODBUS-Project/`
- **MCP server**: `modbus-python` (`modbus-mcp` entrypoint)
- **Mock**: `modbus-mock-server`

Capabilities:

- Coils, discrete inputs, holding/input registers
- Typed reads/writes with byte/word ordering and scaling
- Tag maps for named points (`list_tags`, `read_tag`, `write_tag`)

Use cases:

- Reading process values from RTUs and drives
- Writing setpoints and control flags
- Exploring register maps safely against the mock

### 4.2 MQTT + Sparkplug B

- **Project**: `MQTT-Project/`
- **MCP server**: `mqtt-python` (`mqtt-mcp`)
- **Mock**: `mqtt-mock-server`

Capabilities:

- Standard MQTT publish/subscribe tools
- Full Sparkplug B lifecycle: NBIRTH/DBIRTH, NDATA/DDATA, NCMD/DCMD
- Tools for listing subscriptions, nodes, and decoding payloads

Use cases:

- IIoT telemetry ingestion and monitoring
- Command/control over Sparkplug B metrics
- Testing topic strategies and payload formats against the mock

### 4.3 OPC UA

- **Project**: `OPCUA-Project/`
- **MCP server**: `opcua-mcp-server`
- **Mock**: `opcua-local-server`

Capabilities:

- Read/write node values
- Browse node hierarchies
- Call OPC UA methods
- Bulk read/write and “get all variables”

Use cases:

- Unified access to heterogeneous PLC data via OPC UA
- Complex workflows: browse → select nodes → read/write → call methods
- Training assistants on a realistic but safe simulated plant

### 4.4 BACnet, DNP3, EtherCAT, EtherNet/IP, PROFIBUS, PROFINET, S7comm

Each of these protocol projects mirrors the same approach:

- **BACnet-Project** – BACnet/IP devices for building automation
- **DNP3-Project** – DNP3 outstations and SCADA points
- **EtherCAT-Project** – EtherCAT slave discovery and PDO/SDO access
- **EtherNetIP-Project** – Rockwell/AB controllers and tag operations
- **PROFIBUS-Project** – PROFIBUS DP/PA bus scanning and cyclic data
- **PROFINET-Project** – PROFINET IO devices, modules, and diagnostics
- **S7comm-Project** – Siemens S7 PLCs via S7comm

For each:

- A Python MCP server wraps the relevant client libraries
- A mock device/server provides a safe playground
- A roadmap document under `docs/roadmap/` (referenced from each README) outlines phased implementation

---

## 5. MCP Tool Design

### 5.1 Tool Semantics

Tools are designed to be:

- **High‑level** enough to be meaningful (“read_tag”, “write_tag”, “browse_node_children”)
- **Structured** in both inputs and outputs (typed parameters, well‑shaped results)
- **Composable** so assistants can chain operations:
  - Discover devices or nodes
  - Read measurements
  - Write commands or setpoints
  - Analyze results and decide on follow‑up actions

### 5.2 Response Envelope

All tools return a common envelope:

```json
{
  "success": true,
  "data": { "protocol_specific": "payload" },
  "error": null,
  "meta": {
    "latency_ms": 12,
    "debug": { "raw_request": "...", "raw_response": "..." }
  }
}
```

This helps:

- MCP clients and assistants reason about errors consistently
- Logging and observability (via the `meta` channel)
- Future cross‑protocol orchestration (e.g., “check Modbus and OPC UA views of the same process value”)

### 5.3 Configuration

Servers are configured via environment variables (and optional `.env` files), for example:

- Modbus: `MODBUS_TYPE`, `MODBUS_HOST`, `MODBUS_PORT`, `MODBUS_DEFAULT_SLAVE_ID`, …
- MQTT: `MQTT_BROKER_URL`, `MQTT_CLIENT_ID`, `SPARKPLUG_GROUP_ID`, …
- OPC UA: `OPCUA_SERVER_URL`
- S7: `S7_HOST`, `S7_RACK`, `S7_SLOT`, `S7_TIMEOUT`, …

This keeps configuration separate from code and allows:

- Easy swapping between mock devices and real equipment
- Per‑environment overrides in containerized deployments

---

## 6. Safety and Security Considerations

### 6.1 Mock‑First Development

Every protocol module ships with a mock server/device specifically so you can:

- Develop and test prompts and workflows without touching live equipment
- Validate reasoning and edge cases under controlled conditions
- Demonstrate capabilities safely in workshops or labs

Recommended practice:

1. Build and debug flows against mock servers.
2. Gate access to real devices behind configuration, approvals, and network segmentation.

### 6.2 Network and Access Controls

The MCP servers assume that:

- You deploy them in environments with appropriate network controls (firewalls, VPNs, segmentation).
- Access to the servers and their configuration is restricted to trusted operators.

At the protocol level, future work includes:

- Stronger authentication where applicable (e.g., OPC UA security policies, MQTT authentication)
- Optional read‑only modes to prohibit writes in sensitive environments

### 6.3 Secrets and Configuration

Best practices:

- Do not hard‑code credentials or sensitive endpoints in code.
- Use environment variables or external secret managers.
- Keep `.env` files and any generated data directories out of version control.

---

## 7. Deployment Patterns

### 7.1 Local Development / Lab

- Run mock servers and MCP servers on the same machine or lab network.
- Use Claude Desktop or `mcp-manager-ui` to connect over stdio.
- Iterate on:
  - Prompting strategies
  - Tool usage patterns
  - Error handling and fallback behavior

### 7.2 Staging

- Point MCP servers at staging or shadow copies of industrial systems.
- Enable logging and observability on the MCP side to understand tool usage.
- Continue to allow mock servers for regression testing.

### 7.3 Production

- Deploy MCP servers close to the OT network (e.g., edge gateways).
- Restrict write capabilities where necessary (env flags, config).
- Monitor:
  - Tool call frequency and latency
  - Error rates and timeouts
  - Any anomalous patterns

---

## 8. Current Status and Roadmap

As of now:

- All major protocol projects are structured with:
  - A Python MCP server
  - A mock device/server
  - A documented roadmap and quickstart README
- Node/TypeScript MCP implementations that previously existed have been removed in favor of a simpler Python‑first story and more consistent maintenance.

Next steps and ongoing work typically include:

- Expanding tool coverage (e.g., more SZL areas for S7, more DNP3 function codes, richer BACnet object support)
- Hardening error handling and reconnection logic
- Adding more realistic scenarios to mock servers (faults, alarms, degraded modes)
- Tightening security (TLS, authentication, fine‑grained write permissions)

Refer to each protocol project’s `docs/roadmap/…` for specific milestones and design notes.

---

## 9. How to Use This Whitepaper

Use this document as:

- A conceptual map of the IndustriConnect MCP suite
- A guide when planning deployments or demos
- A reference when contributing new tools or protocol coverage

For concrete commands, configuration snippets, and code‑level details, always pair this with:

- The root `README.md` in `IndustriConnect-MCPs/`
- The `README.md` files inside each protocol project
- Any roadmap documents linked from those READMEs

