#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Client } from "ads-client";
import dotenv from "dotenv";

dotenv.config();

// MCP Server Setup
const server = new Server(
    {
        name: "ads-mcp",
        version: "0.1.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

const ADS_NET_ID = process.env.ADS_NET_ID || "127.0.0.1.1.1";
const ADS_PORT = parseInt(process.env.ADS_PORT || "851");

const client = new Client({
    targetAmsNetId: ADS_NET_ID,
    targetAdsPort: ADS_PORT,
});

async function connectClient() {
    try {
        await client.connect();
        console.error(`Connected to ${ADS_NET_ID}:${ADS_PORT}`);
    } catch (err) {
        console.error(`Failed to connect: ${err}`);
    }
}

connectClient();

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "read_symbol",
                description: "Read a variable by symbol name",
                inputSchema: {
                    type: "object",
                    properties: {
                        symbol_name: { type: "string", description: "Name of the symbol to read" },
                    },
                    required: ["symbol_name"],
                },
            },
            {
                name: "write_symbol",
                description: "Write a value to a symbol",
                inputSchema: {
                    type: "object",
                    properties: {
                        symbol_name: { type: "string", description: "Name of the symbol to write" },
                        value: { type: "number", description: "Value to write" },
                    },
                    required: ["symbol_name", "value"],
                },
            },
            {
                name: "read_device_info",
                description: "Read device information",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
            {
                name: "read_state",
                description: "Read PLC state",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
        ],
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
        const { name, arguments: args } = request.params;

        if (name === "read_symbol") {
            const { symbol_name } = args as any;
            const res = await client.readSymbol(symbol_name);
            return {
                content: [{ type: "text", text: `Symbol ${symbol_name} = ${res.value}` }],
            };
        }

        if (name === "write_symbol") {
            const { symbol_name, value } = args as any;
            await client.writeSymbol(symbol_name, value);
            return {
                content: [{ type: "text", text: `Successfully wrote ${value} to ${symbol_name}` }],
            };
        }

        if (name === "read_device_info") {
            const info = await client.readDeviceInfo();
            return {
                content: [{ type: "text", text: `Device Info: ${JSON.stringify(info)}` }],
            };
        }

        if (name === "read_state") {
            const state = await client.readState();
            return {
                content: [{ type: "text", text: `State: ${JSON.stringify(state)}` }],
            };
        }

        throw new Error(`Unknown tool: ${name}`);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            content: [{ type: "text", text: `Error: ${errorMessage}` }],
            isError: true,
        };
    }
});

const transport = new StdioServerTransport();
await server.connect(transport);
