class ConnectionManager {
    constructor() {
        this.connections = [];
        this.loadConnections();
    }

    loadConnections() {
        const saved = localStorage.getItem('mcp_connections');
        if (saved) {
            this.connections = JSON.parse(saved);
        } else {
            // Default connections for demo
            this.connections = [
                { id: '1', name: 'Modbus TCP', protocol: 'MODBUS', host: '192.168.1.10', port: 502, status: 'connected' },
                { id: '2', name: 'Siemens S7', protocol: 'S7', host: '192.168.1.20', port: 102, status: 'connected' },
                { id: '3', name: 'Omron FINS', protocol: 'FINS', host: '192.168.1.30', port: 9600, status: 'connected' },
                { id: '4', name: 'Beckhoff ADS', protocol: 'ADS', host: '127.0.0.1.1.1', port: 851, status: 'connected' }
            ];
        }
        this.renderConnections();
    }

    saveConnections() {
        localStorage.setItem('mcp_connections', JSON.stringify(this.connections));
    }

    addConnection(connection) {
        this.connections.push({ ...connection, id: Date.now().toString(), status: 'disconnected' });
        this.saveConnections();
        this.renderConnections();
    }

    removeConnection(id) {
        this.connections = this.connections.filter(c => c.id !== id);
        this.saveConnections();
        this.renderConnections();
    }

    renderConnections() {
        const list = document.getElementById('connections-list');
        if (!list) return;

        list.innerHTML = '';
        this.connections.forEach(conn => {
            const card = document.createElement('div');
            card.className = 'connection-card';
            card.innerHTML = `
                <div class="conn-header">
                    <div class="proto-icon ${conn.protocol.toLowerCase()}">${conn.protocol.substring(0, 2)}</div>
                    <div class="conn-info">
                        <h3>${conn.name}</h3>
                        <span class="conn-meta">${conn.host}:${conn.port}</span>
                    </div>
                    <div class="conn-status ${conn.status}">
                        <span class="dot"></span>
                    </div>
                </div>
                <div class="conn-actions">
                    <button class="btn-sm" onclick="connManager.toggleConnection('${conn.id}')">
                        ${conn.status === 'connected' ? 'Disconnect' : 'Connect'}
                    </button>
                    <button class="btn-sm icon-only" onclick="connManager.removeConnection('${conn.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
            list.appendChild(card);
        });
    }

    toggleConnection(id) {
        const conn = this.connections.find(c => c.id === id);
        if (conn) {
            conn.status = conn.status === 'connected' ? 'disconnected' : 'connected';
            this.saveConnections();
            this.renderConnections();
            // Trigger global event or update dashboard
            updateDashboardStats();
        }
    }
}

const connManager = new ConnectionManager();
