#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import dgram from "dgram";
import net from "net";
import dotenv from "dotenv";

dotenv.config();

// FINS Client Implementation
class FINSClient {
    private host: string;
    private port: number;
    private protocol: string;
    private sid: number = 0;

    constructor(host: string, port: number, protocol: string) {
        this.host = host;
        this.port = port;
        this.protocol = protocol.toLowerCase();
    }

    private buildHeader(): Buffer {
        this.sid = (this.sid + 1) % 256;
        // ICF, RSV, GCT, DNA, DA1, DA2, SNA, SA1, SA2, SID
        return Buffer.from([
            0x80, 0x00, 0x02,
            0x00, 0x00, 0x00,
            0x00, 0x00, 0x00,
            this.sid
        ]);
    }

    private async sendCommand(mrc: number, src: number, data: Buffer = Buffer.alloc(0)): Promise<Buffer> {
        const header = this.buildHeader();
        const command = Buffer.concat([Buffer.from([mrc, src]), data]);
        const frame = Buffer.concat([header, command]);

        return new Promise((resolve, reject) => {
            if (this.protocol === 'tcp') {
                const client = new net.Socket();
                client.setTimeout(5000);

                client.connect(this.port, this.host, () => {
                    client.write(frame);
                });

                client.on('data', (response) => {
                    client.destroy();
                    resolve(response);
                });

                client.on('error', (err) => {
                    client.destroy();
                    reject(err);
                });

                client.on('timeout', () => {
                    client.destroy();
                    reject(new Error('Connection timed out'));
                });
            } else {
                const client = dgram.createSocket('udp4');

                client.send(frame, this.port, this.host, (err) => {
                    if (err) {
                        client.close();
                        reject(err);
                    }
                });

                client.on('message', (msg) => {
                    client.close();
                    resolve(msg);
                });

                client.on('error', (err) => {
                    client.close();
                    reject(err);
                });

                // Simple timeout for UDP
                setTimeout(() => {
                    client.close();
                    // Don't reject if already resolved, but simple implementation
                }, 5000);
            }
        });
    }

    async readMemoryArea(areaCode: number, address: number, count: number): Promise<number[]> {
        // MRC: 01, SRC: 01
        const data = Buffer.alloc(6);
        data.writeUInt8(areaCode, 0);
        data.writeUInt16BE(address, 1);
        data.writeUInt8(0x00, 3); // Bit
        data.writeUInt16BE(count, 4);

        const response = await this.sendCommand(0x01, 0x01, data);

        if (response.length < 14) {
            throw new Error("Response too short");
        }

        const endCode = response.readUInt16BE(12);
        if (endCode !== 0) {
            throw new Error(`PLC Error: ${endCode.toString(16)}`);
        }

        const values: number[] = [];
        const rawData = response.subarray(14);
        for (let i = 0; i < rawData.length; i += 2) {
            if (i + 2 <= rawData.length) {
                values.push(rawData.readUInt16BE(i));
            }
        }
        return values;
    }

    async writeMemoryArea(areaCode: number, address: number, values: number[]): Promise<void> {
        // MRC: 01, SRC: 02
        const count = values.length;
        const headerData = Buffer.alloc(6);
        headerData.writeUInt8(areaCode, 0);
        headerData.writeUInt16BE(address, 1);
        headerData.writeUInt8(0x00, 3);
        headerData.writeUInt16BE(count, 4);

        const valueData = Buffer.alloc(count * 2);
        values.forEach((val, i) => {
            valueData.writeUInt16BE(val, i * 2);
        });

        const data = Buffer.concat([headerData, valueData]);
        const response = await this.sendCommand(0x01, 0x02, data);

        if (response.length < 14) {
            throw new Error("Response too short");
        }

        const endCode = response.readUInt16BE(12);
        if (endCode !== 0) {
            throw new Error(`PLC Error: ${endCode.toString(16)}`);
        }
    }
}

// MCP Server Setup
const server = new Server(
    {
        name: "fins-mcp",
        version: "0.1.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

const FINS_HOST = process.env.FINS_HOST || "192.168.1.10";
const FINS_PORT = parseInt(process.env.FINS_PORT || "9600");
const FINS_PROTOCOL = process.env.FINS_PROTOCOL || "tcp";

const client = new FINSClient(FINS_HOST, FINS_PORT, FINS_PROTOCOL);

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "read_memory_area",
                description: "Read words from a specific memory area",
                inputSchema: {
                    type: "object",
                    properties: {
                        area_code: { type: "number", description: "Memory area code (e.g., 0x82 for DM)" },
                        address: { type: "number", description: "Starting word address" },
                        count: { type: "number", description: "Number of words to read" },
                    },
                    required: ["area_code", "address", "count"],
                },
            },
            {
                name: "write_memory_area",
                description: "Write words to a specific memory area",
                inputSchema: {
                    type: "object",
                    properties: {
                        area_code: { type: "number", description: "Memory area code" },
                        address: { type: "number", description: "Starting word address" },
                        values: {
                            type: "array",
                            items: { type: "number" },
                            description: "List of values to write"
                        },
                    },
                    required: ["area_code", "address", "values"],
                },
            },
            {
                name: "read_dm",
                description: "Read from Data Memory (DM) area",
                inputSchema: {
                    type: "object",
                    properties: {
                        address: { type: "number", description: "Starting DM address" },
                        count: { type: "number", description: "Number of words to read" },
                    },
                    required: ["address", "count"],
                },
            },
            {
                name: "write_dm",
                description: "Write to Data Memory (DM) area",
                inputSchema: {
                    type: "object",
                    properties: {
                        address: { type: "number", description: "Starting DM address" },
                        values: {
                            type: "array",
                            items: { type: "number" },
                            description: "List of values to write"
                        },
                    },
                    required: ["address", "values"],
                },
            },
        ],
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
        const { name, arguments: args } = request.params;

        if (name === "read_memory_area") {
            const { area_code, address, count } = args as any;
            const values = await client.readMemoryArea(area_code, address, count);
            return {
                content: [{ type: "text", text: `Read ${count} words from Area ${area_code.toString(16)} Address ${address}: ${JSON.stringify(values)}` }],
            };
        }

        if (name === "write_memory_area") {
            const { area_code, address, values } = args as any;
            await client.writeMemoryArea(area_code, address, values);
            return {
                content: [{ type: "text", text: `Successfully wrote ${values.length} words to Area ${area_code.toString(16)} Address ${address}` }],
            };
        }

        if (name === "read_dm") {
            const { address, count } = args as any;
            const values = await client.readMemoryArea(0x82, address, count);
            return {
                content: [{ type: "text", text: `DM[${address}:${address + count - 1}] = ${JSON.stringify(values)}` }],
            };
        }

        if (name === "write_dm") {
            const { address, values } = args as any;
            await client.writeMemoryArea(0x82, address, values);
            return {
                content: [{ type: "text", text: `Successfully wrote to DM[${address}]` }],
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
