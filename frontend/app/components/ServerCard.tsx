"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ServerStatus, ServerMetricsPoint } from "../types";

interface Props {
  server: ServerStatus;
  metrics: ServerMetricsPoint[];
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onBackup: (id: string) => void;
  onConsole: (id: string) => void;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function ServerCard({
  server,
  metrics,
  onStart,
  onStop,
  onBackup,
  onConsole,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function handleAction(action: () => void | Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  const chartData = metrics.map((p) => ({
    time: formatTime(p.ts),
    cpu: parseFloat(p.cpu_percent.toFixed(1)),
    mem: parseFloat(p.mem_mb.toFixed(1)),
  }));

  return (
    <div className="bg-white rounded-xl shadow-md p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-3">
        <h2 className="text-xl font-bold text-gray-800">{server.name}</h2>
        <span
          className={`px-3 py-1 rounded-full text-sm font-semibold ${
            server.running
              ? "bg-green-500 text-white"
              : "bg-red-500 text-white"
          }`}
        >
          {server.running ? "Running" : "Stopped"}
        </span>
      </div>

      {/* Info */}
      <div className="text-sm text-gray-600 space-y-1">
        <div className="flex justify-between">
          <span className="font-medium">Port:</span>
          <span>{server.port}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Path:</span>
          <span className="truncate max-w-[200px] text-right">{server.path}</span>
        </div>
        {server.running && (
          <>
            <div className="flex justify-between">
              <span className="font-medium">PID:</span>
              <span>{server.pid ?? "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">CPU:</span>
              <span>
                {server.cpu_percent != null
                  ? server.cpu_percent.toFixed(1) + "%"
                  : "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Memory:</span>
              <span>
                {server.memory_mb != null
                  ? server.memory_mb.toFixed(1) + " MB"
                  : "N/A"}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Graphs */}
      {chartData.length > 1 && (
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">
              Server CPU %
            </p>
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={`cpuGrad-${server.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide />
                <YAxis domain={[0, 100]} hide />
                <Tooltip
                  contentStyle={{ fontSize: "0.75rem" }}
                  formatter={(v) => [`${v ?? 0}%`, "CPU"]}
                />
                <Area
                  type="monotone"
                  dataKey="cpu"
                  stroke="#6366f1"
                  fill={`url(#cpuGrad-${server.id})`}
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">
              Server RAM (MB)
            </p>
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={`memGrad-${server.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ fontSize: "0.75rem" }}
                  formatter={(v) => [`${v ?? 0} MB`, "RAM"]}
                />
                <Area
                  type="monotone"
                  dataKey="mem"
                  stroke="#10b981"
                  fill={`url(#memGrad-${server.id})`}
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto">
        {server.running ? (
          <button
            onClick={() => handleAction(() => onStop(server.id))}
            disabled={busy}
            className="flex-1 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-semibold rounded-lg transition"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={() => handleAction(() => onStart(server.id))}
            disabled={busy}
            className="flex-1 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-semibold rounded-lg transition"
          >
            Start
          </button>
        )}
        <button
          onClick={() => onBackup(server.id)}
          className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition"
        >
          Backup
        </button>
        <button
          onClick={() => onConsole(server.id)}
          className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition"
        >
          Console
        </button>
      </div>
    </div>
  );
}
