"use client";

import { useEffect, useState, useCallback } from "react";
import ServerCard from "./components/ServerCard";
import SystemMetricsChart from "./components/SystemMetricsChart";
import ConsoleModal from "./components/ConsoleModal";
import type {
  ServerStatus,
  SystemMetricsPoint,
  ServerMetricsPoint,
} from "./types";

type Toast = { message: string; type: "success" | "error" } | null;

export default function Home() {
  const [servers, setServers] = useState<ServerStatus[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetricsPoint[]>([]);
  const [serverMetrics, setServerMetrics] = useState<
    Record<string, ServerMetricsPoint[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast>(null);
  const [consoleServer, setConsoleServer] = useState<string | null>(null);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  const fetchAll = useCallback(async () => {
    try {
      const [serversRes, sysRes] = await Promise.all([
        fetch("/api/servers"),
        fetch("/api/metrics/system"),
      ]);
      const serversData: ServerStatus[] = await serversRes.json();
      const sysData: SystemMetricsPoint[] = await sysRes.json();

      setServers(serversData);
      setSystemMetrics(sysData);

      // Fetch per-server metrics in parallel
      const entries = await Promise.all(
        serversData.map(async (s) => {
          const res = await fetch(`/api/servers/${s.id}/metrics`);
          const data: ServerMetricsPoint[] = await res.json();
          return [s.id, data] as [string, ServerMetricsPoint[]];
        })
      );
      setServerMetrics(Object.fromEntries(entries));
    } catch {
      // keep showing last known state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  async function handleStart(serverId: string) {
    const res = await fetch(`/api/servers/${serverId}/start`, {
      method: "POST",
    });
    const data = await res.json();
    showToast(data.message, data.success ? "success" : "error");
    if (data.success) setTimeout(fetchAll, 1000);
  }

  async function handleStop(serverId: string) {
    const res = await fetch(`/api/servers/${serverId}/stop`, {
      method: "POST",
    });
    const data = await res.json();
    showToast(data.message, data.success ? "success" : "error");
    if (data.success) setTimeout(fetchAll, 1000);
  }

  async function handleBackup(serverId: string) {
    showToast("Creating backup…");
    const res = await fetch(`/api/servers/${serverId}/backup`, {
      method: "POST",
    });
    const data = await res.json();
    showToast(data.message, data.success ? "success" : "error");
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-700 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="text-center text-white">
          <h1 className="text-4xl font-extrabold tracking-tight drop-shadow">
            ⛏️ Minecraft Server Manager
          </h1>
          <p className="mt-1 text-indigo-100 text-lg">
            Manage your Minecraft servers with ease
          </p>
        </header>

        {/* System Metrics */}
        <SystemMetricsChart history={systemMetrics} />

        {/* Servers */}
        {loading ? (
          <p className="text-white text-center text-lg">Loading servers…</p>
        ) : servers.length === 0 ? (
          <div className="bg-white rounded-xl p-10 text-center text-gray-500">
            <h2 className="text-xl font-bold mb-2">No servers configured</h2>
            <p>Add servers to your config.json file to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {servers.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                metrics={serverMetrics[server.id] ?? []}
                onStart={handleStart}
                onStop={handleStop}
                onBackup={handleBackup}
                onConsole={setConsoleServer}
              />
            ))}
          </div>
        )}
      </div>

      {/* Console modal */}
      {consoleServer && (
        <ConsoleModal
          serverId={consoleServer}
          onClose={() => setConsoleServer(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 px-5 py-3 rounded-lg text-white font-semibold shadow-lg transition-all ${
            toast.type === "success" ? "bg-green-500" : "bg-red-500"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Refresh FAB */}
      <button
        onClick={fetchAll}
        title="Refresh"
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white text-2xl shadow-lg transition hover:rotate-180"
      >
        🔄
      </button>
    </main>
  );
}
