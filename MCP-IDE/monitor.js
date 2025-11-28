class MonitorManager {
    constructor() {
        this.isMonitoring = true;
        this.updateInterval = null;
        this.startMonitoring();
    }

    startMonitoring() {
        if (this.updateInterval) clearInterval(this.updateInterval);
        this.updateInterval = setInterval(() => this.updateWidgets(), 2000);
    }

    stopMonitoring() {
        if (this.updateInterval) clearInterval(this.updateInterval);
        this.isMonitoring = false;
    }

    updateWidgets() {
        if (!this.isMonitoring) return;

        // Update Gauge
        const gaugeValue = document.querySelector('.gauge-value');
        if (gaugeValue) {
            const states = ['RUNNING', 'IDLE', 'RUNNING', 'RUNNING', 'MAINTENANCE'];
            gaugeValue.textContent = states[Math.floor(Math.random() * states.length)];
            gaugeValue.style.color = gaugeValue.textContent === 'RUNNING' ? 'var(--success-text)' :
                gaugeValue.textContent === 'IDLE' ? 'var(--warning)' : 'var(--danger)';
        }

        // Update Metric
        const metricValue = document.querySelector('.metric-value');
        if (metricValue) {
            const current = parseInt(metricValue.textContent.replace(',', ''));
            const change = Math.floor(Math.random() * 20) - 5;
            metricValue.textContent = (current + change).toLocaleString();
        }

        // Update Chart (Simulated)
        // In a real app, we'd use Chart.js or similar
    }
}

const monitorManager = new MonitorManager();
