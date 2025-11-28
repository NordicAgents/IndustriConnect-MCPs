// Mock Data for Tool Tester
const tools = [
    // FINS Tools
    {
        name: "read_memory_area",
        description: "Read words from a specific memory area",
        protocol: "FINS",
        args: [
            { name: "area_code", type: "number", default: 130 },
            { name: "address", type: "number", default: 1000 },
            { name: "count", type: "number", default: 10 }
        ]
    },
    {
        name: "write_memory_area",
        description: "Write words to a specific memory area",
        protocol: "FINS",
        args: [
            { name: "area_code", type: "number", default: 130 },
            { name: "address", type: "number", default: 1000 },
            { name: "values", type: "array", default: "[0, 0]" }
        ]
    },
    // ADS Tools
    {
        name: "read_symbol",
        description: "Read a variable by symbol name",
        protocol: "ADS",
        args: [
            { name: "symbol_name", type: "string", default: "MAIN.MyVar" }
        ]
    },
    {
        name: "write_symbol",
        description: "Write a value to a symbol",
        protocol: "ADS",
        args: [
            { name: "symbol_name", type: "string", default: "MAIN.MyVar" },
            { name: "value", type: "number", default: 0 }
        ]
    },
    // MODBUS Tools
    {
        name: "read_holding_registers",
        description: "Read holding registers",
        protocol: "MODBUS",
        args: [
            { name: "address", type: "number", default: 0 },
            { name: "count", type: "number", default: 1 }
        ]
    },
    {
        name: "write_multiple_registers",
        description: "Write multiple registers",
        protocol: "MODBUS",
        args: [
            { name: "address", type: "number", default: 0 },
            { name: "values", type: "array", default: "[0]" }
        ]
    },
    // S7 Tools
    {
        name: "read_db",
        description: "Read from a Data Block",
        protocol: "S7",
        args: [
            { name: "db_number", type: "number", default: 1 },
            { name: "start", type: "number", default: 0 },
            { name: "size", type: "number", default: 2 }
        ]
    },
    // EtherNet/IP Tools
    {
        name: "read_tag",
        description: "Read a CIP tag",
        protocol: "EIP",
        args: [
            { name: "tag_name", type: "string", default: "MyTag" }
        ]
    },
    // PROFINET Tools
    {
        name: "read_record",
        description: "Read data record",
        protocol: "PN",
        args: [
            { name: "index", type: "number", default: 1 }
        ]
    },
    // EtherCAT Tools
    {
        name: "read_sdo",
        description: "Read SDO",
        protocol: "ECAT",
        args: [
            { name: "index", type: "number", default: 0x1000 },
            { name: "subindex", type: "number", default: 0 }
        ]
    },
    // OPC UA Tools
    {
        name: "read_node",
        description: "Read node value",
        protocol: "OPC",
        args: [
            { name: "node_id", type: "string", default: "ns=2;s=Demo.Static.Scalar.Double" }
        ]
    },
    // MQTT Tools
    {
        name: "publish_message",
        description: "Publish a message to a topic",
        protocol: "MQTT",
        args: [
            { name: "topic", type: "string", default: "factory/sensor1" },
            { name: "payload", type: "string", default: "{ \"value\": 123 }" }
        ]
    },
    // BACnet Tools
    {
        name: "read_property",
        description: "Read object property",
        protocol: "BAC",
        args: [
            { name: "object_type", type: "string", default: "analog-input" },
            { name: "instance", type: "number", default: 1 }
        ]
    },
    // DNP3 Tools
    {
        name: "read_point",
        description: "Read data point",
        protocol: "DNP3",
        args: [
            { name: "group", type: "number", default: 30 },
            { name: "index", type: "number", default: 0 }
        ]
    },
    // MELSEC Tools
    {
        name: "read_device",
        description: "Read device memory",
        protocol: "MC",
        args: [
            { name: "device", type: "string", default: "D100" },
            { name: "count", type: "number", default: 1 }
        ]
    }
];

document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupToolTester();
    setupConnections();
});

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-links li');
    const views = document.querySelectorAll('.view');
    const breadcrumbCurrent = document.querySelector('.crumb-current');

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            // Remove active class from all links
            navLinks.forEach(l => l.classList.remove('active'));
            // Add active class to clicked link
            link.classList.add('active');

            // Hide all views
            views.forEach(view => view.classList.remove('active'));

            // Show target view
            const targetId = link.getAttribute('data-tab');
            const targetView = document.getElementById(`${targetId}-view`);
            if (targetView) {
                targetView.classList.add('active');
            }

            // Update breadcrumb
            const text = link.querySelector('span').textContent;
            breadcrumbCurrent.textContent = text;
        });
    });
}

function setupToolTester() {
    const toolList = document.getElementById('tool-list');
    const toolForm = document.getElementById('tool-form');
    const runBtn = document.getElementById('run-tool-btn');
    const output = document.getElementById('tool-output');
    let currentTool = null;

    // Populate tool list
    tools.forEach(tool => {
        const item = document.createElement('div');
        item.className = 'tool-item';
        item.innerHTML = `
            <h4>${tool.name}</h4>
            <p><span class="status ${tool.protocol.toLowerCase()}">${tool.protocol}</span> ${tool.description}</p>
        `;

        item.addEventListener('click', () => {
            // Update active state
            document.querySelectorAll('.tool-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // Select tool
            currentTool = tool;
            renderToolForm(tool);
            runBtn.disabled = false;
            output.textContent = '// Ready to run ' + tool.name;
        });

        toolList.appendChild(item);
    });

    // Run tool handler
    runBtn.addEventListener('click', () => {
        if (!currentTool) return;

        runBtn.textContent = 'Running...';
        runBtn.disabled = true;
        output.textContent = '// Sending request to ' + currentTool.protocol + ' server...\n';

        // Simulate API call
        setTimeout(() => {
            const result = simulateToolExecution(currentTool);
            output.textContent += JSON.stringify(result, null, 2);
            runBtn.textContent = 'Run Tool';
            runBtn.disabled = false;
        }, 600 + Math.random() * 400);
    });
}

function renderToolForm(tool) {
    const form = document.getElementById('tool-form');
    form.innerHTML = '';

    tool.args.forEach(arg => {
        const group = document.createElement('div');
        group.className = 'form-group';

        const label = document.createElement('label');
        label.textContent = `${arg.name} (${arg.type})`;

        const input = document.createElement('input');
        input.type = arg.type === 'number' ? 'number' : 'text';
        input.value = arg.default;
        input.placeholder = `Enter ${arg.name}`;

        group.appendChild(label);
        group.appendChild(input);
        form.appendChild(group);
    });
}

function simulateToolExecution(tool) {
    const timestamp = new Date().toISOString();

    if (tool.name.includes('read')) {
        return {
            success: true,
            data: {
                values: [Math.floor(Math.random() * 1000), Math.floor(Math.random() * 1000)],
                timestamp: timestamp
            },
            meta: {
                execution_time_ms: Math.floor(Math.random() * 50) + 10
            }
        };
    } else {
        return {
            success: true,
            message: "Write operation successful",
            meta: {
                execution_time_ms: Math.floor(Math.random() * 50) + 20
            }
        };
    }
}

function setupConnections() {
    // Placeholder for dynamic connection management
    // This is now handled by connections.js
}
