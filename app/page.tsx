'use client';

import { useState, useEffect } from 'react';

interface ServerStatus {
  id: string;
  name: string;
  running: boolean;
  path: string;
  port: number;
  pid?: number;
  cpu_percent?: number;
  memory_mb?: number;
}

export default function Home() {
  const [servers, setServers] = useState<ServerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [consoleServer, setConsoleServer] = useState<string | null>(null);
  const [consoleOutput, setConsoleOutput] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadServers = async () => {
    try {
      const response = await fetch('/api/servers');
      const data = await response.json();
      setServers(data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading servers:', error);
      showMessage('Failed to load servers', 'error');
      setLoading(false);
    }
  };

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const startServer = async (serverId: string) => {
    try {
      const response = await fetch(`/api/servers/${serverId}/start`, { method: 'POST' });
      const data = await response.json();
      showMessage(data.message, data.success ? 'success' : 'error');
      if (data.success) {
        setTimeout(loadServers, 1000);
      }
    } catch (error) {
      showMessage('Failed to start server', 'error');
    }
  };

  const stopServer = async (serverId: string) => {
    try {
      const response = await fetch(`/api/servers/${serverId}/stop`, { method: 'POST' });
      const data = await response.json();
      showMessage(data.message, data.success ? 'success' : 'error');
      if (data.success) {
        setTimeout(loadServers, 1000);
      }
    } catch (error) {
      showMessage('Failed to stop server', 'error');
    }
  };

  const backupServer = async (serverId: string) => {
    showMessage('Creating backup...', 'success');
    try {
      const response = await fetch(`/api/servers/${serverId}/backup`, { method: 'POST' });
      const data = await response.json();
      showMessage(data.message, data.success ? 'success' : 'error');
    } catch (error) {
      showMessage('Failed to create backup', 'error');
    }
  };

  const showConsole = async (serverId: string) => {
    setConsoleServer(serverId);
    updateConsole(serverId);
  };

  const updateConsole = async (serverId: string) => {
    try {
      const response = await fetch(`/api/servers/${serverId}/console?lines=100`);
      const data = await response.json();
      setConsoleOutput(data.output || 'No console output available');
    } catch (error) {
      console.error('Error loading console:', error);
    }
  };

  const closeConsole = () => {
    setConsoleServer(null);
    setConsoleOutput('');
  };

  useEffect(() => {
    loadServers();
    const interval = setInterval(loadServers, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (consoleServer) {
      const interval = setInterval(() => updateConsole(consoleServer), 5000);
      return () => clearInterval(interval);
    }
  }, [consoleServer]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading servers...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-900 p-5">
      <div className="max-w-7xl mx-auto">
        <header className="text-center text-white mb-8">
          <h1 className="text-5xl font-bold mb-3 drop-shadow-lg">⛏️ Minecraft Server Manager</h1>
          <p className="text-xl opacity-90">Manage your Minecraft servers with ease</p>
        </header>

        {servers.length === 0 ? (
          <div className="bg-white rounded-xl p-10 text-center">
            <h2 className="text-2xl font-bold mb-2">No servers configured</h2>
            <p className="text-gray-600">Add servers to your config.json file to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
            {servers.map((server) => (
              <div
                key={server.id}
                className="bg-white rounded-xl p-5 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1"
              >
                <div className="flex justify-between items-center mb-4 pb-3 border-b-2">
                  <div className="text-2xl font-bold text-gray-800">{server.name}</div>
                  <div
                    className={`px-4 py-1 rounded-full text-sm font-bold ${
                      server.running ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    }`}
                  >
                    {server.running ? 'Running' : 'Stopped'}
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-bold text-gray-600">Port:</span>
                    <span className="text-gray-800">{server.port}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-bold text-gray-600">Path:</span>
                    <span className="text-gray-800 text-sm truncate max-w-[200px]">{server.path}</span>
                  </div>
                  {server.running && (
                    <>
                      <div className="flex justify-between py-2 border-b">
                        <span className="font-bold text-gray-600">PID:</span>
                        <span className="text-gray-800">{server.pid || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="font-bold text-gray-600">Memory:</span>
                        <span className="text-gray-800">
                          {server.memory_mb ? `${server.memory_mb.toFixed(1)} MB` : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="font-bold text-gray-600">CPU:</span>
                        <span className="text-gray-800">
                          {server.cpu_percent ? `${server.cpu_percent.toFixed(1)}%` : 'N/A'}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  {server.running ? (
                    <button
                      onClick={() => stopServer(server.id)}
                      className="flex-1 bg-red-500 text-white py-2 px-4 rounded-lg font-bold hover:bg-red-600 transition-colors"
                    >
                      Stop
                    </button>
                  ) : (
                    <button
                      onClick={() => startServer(server.id)}
                      className="flex-1 bg-green-500 text-white py-2 px-4 rounded-lg font-bold hover:bg-green-600 transition-colors"
                    >
                      Start
                    </button>
                  )}
                  <button
                    onClick={() => backupServer(server.id)}
                    className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg font-bold hover:bg-blue-600 transition-colors"
                  >
                    Backup
                  </button>
                  <button
                    onClick={() => showConsole(server.id)}
                    className="flex-1 bg-orange-500 text-white py-2 px-4 rounded-lg font-bold hover:bg-orange-600 transition-colors"
                  >
                    Console
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {consoleServer && (
          <div className="bg-white rounded-xl p-5 mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">Console: {consoleServer}</h2>
              <button
                onClick={closeConsole}
                className="bg-red-500 text-white py-2 px-6 rounded-lg font-bold hover:bg-red-600 transition-colors"
              >
                Close
              </button>
            </div>
            <div className="bg-gray-900 text-gray-300 p-4 rounded-lg font-mono text-sm h-96 overflow-y-auto whitespace-pre-wrap">
              {consoleOutput}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={loadServers}
        className="fixed bottom-8 right-8 w-16 h-16 bg-purple-600 text-white rounded-full text-3xl shadow-lg hover:bg-purple-700 transition-all hover:rotate-180"
        title="Refresh"
      >
        🔄
      </button>

      {message && (
        <div
          className={`fixed top-5 right-5 px-6 py-4 rounded-lg text-white font-bold shadow-lg animate-slide-in ${
            message.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
