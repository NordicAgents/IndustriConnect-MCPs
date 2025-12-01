import express from 'express';
import cors from 'cors';
import { MCPWebSocketServer } from './websocket-server.js';

const PORT = 3002;
const WS_PORT = 3003;

// Start Express server for health checks / static files if needed
const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'mcp-backend' });
});

app.listen(PORT, () => {
    console.log(`[HTTP] Server running on http://localhost:${PORT}`);
});

// Start WebSocket server
new MCPWebSocketServer(WS_PORT);
