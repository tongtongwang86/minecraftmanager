"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { SystemMetricsPoint } from "../types";

interface Props {
  history: SystemMetricsPoint[];
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function SystemMetricsChart({ history }: Props) {
  const data = history.map((p) => ({
    time: formatTime(p.ts),
    cpu: parseFloat(p.cpu_percent.toFixed(1)),
    ram: parseFloat(p.ram_percent.toFixed(1)),
  }));

  if (data.length < 2) {
    return (
      <div className="bg-white rounded-xl shadow-md p-5 text-gray-400 text-center text-sm">
        Collecting system metrics…
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-5">
      <h2 className="text-lg font-bold text-gray-700 mb-4">
        System Load — CPU &amp; RAM
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CPU */}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1">
            CPU Utilisation %
          </p>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="sysCpuGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
              <Tooltip formatter={(v) => [`${v ?? 0}%`, "CPU"]} />
              <Area
                type="monotone"
                dataKey="cpu"
                stroke="#6366f1"
                fill="url(#sysCpuGrad)"
                strokeWidth={2}
                dot={false}
                name="CPU"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* RAM */}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1">
            RAM Utilisation %
          </p>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="sysRamGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
              <Tooltip formatter={(v) => [`${v ?? 0}%`, "RAM"]} />
              <Area
                type="monotone"
                dataKey="ram"
                stroke="#10b981"
                fill="url(#sysRamGrad)"
                strokeWidth={2}
                dot={false}
                name="RAM"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Latest values */}
      {history.length > 0 && (
        <div className="mt-3 flex gap-6 text-sm text-gray-600">
          <span>
            CPU:{" "}
            <strong>{history[history.length - 1].cpu_percent.toFixed(1)}%</strong>
          </span>
          <span>
            RAM:{" "}
            <strong>
              {history[history.length - 1].ram_used_mb.toFixed(0)} MB /{" "}
              {history[history.length - 1].ram_total_mb.toFixed(0)} MB
            </strong>{" "}
            ({history[history.length - 1].ram_percent.toFixed(1)}%)
          </span>
        </div>
      )}
    </div>
  );
}
