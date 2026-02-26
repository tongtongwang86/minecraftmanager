const API_BASE = '/api/servers';
let currentServerId = null;
let consoleWs = null;
let metricsWs = null;
let cpuChart = null;
let memChart = null;
let isEditing = false;

// DOM Elements
const serverListSection = document.getElementById('server-list-section');
const serverDetailsSection = document.getElementById('server-details-section');
const serverList = document.getElementById('server-list');
const consoleOutput = document.getElementById('console-output');
const consoleInput = document.getElementById('console-input');
const modal = document.getElementById('server-modal');
const serverForm = document.getElementById('server-form');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadServers();
    setupEventListeners();
    initCharts();
});

function setupEventListeners() {
    document.getElementById('btn-refresh').addEventListener('click', loadServers);
    document.getElementById('btn-back').addEventListener('click', showServerList);
    document.getElementById('btn-new-server').addEventListener('click', () => openModal());
    
    document.getElementById('btn-start').addEventListener('click', () => serverAction('start'));
    document.getElementById('btn-stop').addEventListener('click', () => serverAction('stop'));
    document.getElementById('btn-restart').addEventListener('click', () => serverAction('restart'));
    document.getElementById('btn-delete').addEventListener('click', deleteServer);
    document.getElementById('btn-edit').addEventListener('click', () => openModal(currentServerId));

    document.getElementById('btn-send-cmd').addEventListener('click', sendCommand);
    consoleInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendCommand();
    });

    // Modal
    document.querySelector('.close').addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    serverForm.addEventListener('submit', handleServerSubmit);
}

async function loadServers() {
    try {
        const res = await fetch(API_BASE);
        const servers = await res.json();
        renderServerList(servers);
    } catch (err) {
        console.error('Failed to load servers:', err);
        alert('Failed to load servers');
    }
}

function renderServerList(servers) {
    serverList.innerHTML = '';
    servers.forEach(server => {
        const card = document.createElement('div');
        card.className = 'server-card';
        card.innerHTML = `
            <h3>${server.name}</h3>
            <p>ID: ${server.id}</p>
            <p>Port: ${server.port}</p>
            <p>Memory: ${server.memory_mb} MB</p>
            <span class="status-badge status-${server.status}">${server.status.toUpperCase()}</span>
        `;
        card.addEventListener('click', () => showServerDetails(server));
        serverList.appendChild(card);
    });
}

function showServerList() {
    serverDetailsSection.style.display = 'none';
    serverListSection.style.display = 'block';
    currentServerId = null;
    closeWebSockets();
    loadServers();
}

function showServerDetails(server) {
    currentServerId = server.id;
    document.getElementById('detail-title').textContent = `${server.name} (${server.id})`;
    
    serverListSection.style.display = 'none';
    serverDetailsSection.style.display = 'block';
    
    consoleOutput.innerHTML = '';
    resetCharts();
    
    connectWebSockets(server.id);
}

async function serverAction(action) {
    if (!currentServerId) return;
    try {
        const res = await fetch(`${API_BASE}/${currentServerId}/${action}`, { method: 'POST' });
        if (!res.ok) {
            const err = await res.json();
            alert(`Failed to ${action}: ${err.error}`);
        }
    } catch (err) {
        console.error(`Failed to ${action}:`, err);
    }
}

async function deleteServer() {
    if (!currentServerId || !confirm('Are you sure you want to delete this server?')) return;
    try {
        const res = await fetch(`${API_BASE}/${currentServerId}`, { method: 'DELETE' });
        if (res.ok) {
            showServerList();
        } else {
            const err = await res.json();
            alert(`Failed to delete: ${err.error}`);
        }
    } catch (err) {
        console.error('Failed to delete:', err);
    }
}

function connectWebSockets(id) {
    closeWebSockets();
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    // Console WS
    consoleWs = new WebSocket(`${protocol}//${host}/api/servers/${id}/console/ws`);
    consoleWs.onmessage = (event) => {
        const line = document.createElement('div');
        line.textContent = event.data;
        consoleOutput.appendChild(line);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    };
    
    // Metrics WS
    metricsWs = new WebSocket(`${protocol}//${host}/api/servers/${id}/metrics/ws`);
    metricsWs.onmessage = (event) => {
        const metrics = JSON.parse(event.data);
        updateCharts(metrics);
    };
}

function closeWebSockets() {
    if (consoleWs) {
        consoleWs.close();
        consoleWs = null;
    }
    if (metricsWs) {
        metricsWs.close();
        metricsWs = null;
    }
}

function sendCommand() {
    if (!consoleWs || consoleWs.readyState !== WebSocket.OPEN) return;
    const cmd = consoleInput.value.trim();
    if (cmd) {
        consoleWs.send(JSON.stringify({ type: 'command', data: cmd }));
        consoleInput.value = '';
    }
}

// Charts
function initCharts() {
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
            x: { display: false },
            y: { beginAtZero: true }
        }
    };

    const cpuCtx = document.getElementById('cpuChart').getContext('2d');
    cpuChart = new Chart(cpuCtx, {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'CPU Usage (%)', data: [], borderColor: '#e74c3c', tension: 0.1 }] },
        options: { ...commonOptions, scales: { y: { max: 100, beginAtZero: true } } }
    });

    const memCtx = document.getElementById('memChart').getContext('2d');
    memChart = new Chart(memCtx, {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'Memory Usage (MB)', data: [], borderColor: '#3498db', tension: 0.1 }] },
        options: commonOptions
    });
}

function resetCharts() {
    if (cpuChart) {
        cpuChart.data.labels = [];
        cpuChart.data.datasets[0].data = [];
        cpuChart.update();
    }
    if (memChart) {
        memChart.data.labels = [];
        memChart.data.datasets[0].data = [];
        memChart.update();
    }
}

function updateCharts(metrics) {
    const time = new Date(metrics.timestamp_ms).toLocaleTimeString();
    const memMB = metrics.memory_bytes / (1024 * 1024);
    
    const maxPoints = 60; // 1 minute of data at 1s intervals

    // Update CPU
    cpuChart.data.labels.push(time);
    cpuChart.data.datasets[0].data.push(metrics.cpu_percent);
    if (cpuChart.data.labels.length > maxPoints) {
        cpuChart.data.labels.shift();
        cpuChart.data.datasets[0].data.shift();
    }
    cpuChart.update();

    // Update Memory
    memChart.data.labels.push(time);
    memChart.data.datasets[0].data.push(memMB);
    if (memChart.data.labels.length > maxPoints) {
        memChart.data.labels.shift();
        memChart.data.datasets[0].data.shift();
    }
    memChart.update();
}

// Modal & Form Handling
async function openModal(id = null) {
    isEditing = !!id;
    document.getElementById('modal-title').textContent = isEditing ? 'Edit Server' : 'Add Server';
    document.getElementById('server-id').disabled = isEditing;
    
    if (isEditing) {
        try {
            const res = await fetch(API_BASE);
            const servers = await res.json();
            const server = servers.find(s => s.id === id);
            if (server) {
                document.getElementById('server-id').value = server.id;
                document.getElementById('server-name').value = server.name;
                document.getElementById('server-dir').value = server.directory;
                document.getElementById('server-jar').value = server.jar;
                document.getElementById('server-mem').value = server.memory_mb;
                document.getElementById('server-port').value = server.port;
                document.getElementById('server-autostart').checked = server.autostart;
            }
        } catch (err) {
            console.error('Failed to load server details:', err);
        }
    } else {
        serverForm.reset();
    }
    
    modal.style.display = 'block';
}

function closeModal() {
    modal.style.display = 'none';
}

async function handleServerSubmit(e) {
    e.preventDefault();
    
    const serverData = {
        id: document.getElementById('server-id').value,
        name: document.getElementById('server-name').value,
        directory: document.getElementById('server-dir').value,
        jar: document.getElementById('server-jar').value,
        memory_mb: parseInt(document.getElementById('server-mem').value),
        port: parseInt(document.getElementById('server-port').value),
        autostart: document.getElementById('server-autostart').checked
    };

    try {
        const url = isEditing ? `${API_BASE}/${serverData.id}` : API_BASE;
        const method = isEditing ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(serverData)
        });

        if (res.ok) {
            closeModal();
            if (currentServerId) {
                // If we were viewing this server, refresh its details
                showServerList();
            } else {
                loadServers();
            }
        } else {
            const err = await res.json();
            alert(`Failed to save server: ${err.error}`);
        }
    } catch (err) {
        console.error('Failed to save server:', err);
        alert('Failed to save server');
    }
}