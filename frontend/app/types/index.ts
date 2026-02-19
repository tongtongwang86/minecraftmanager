export interface ServerStatus {
  id: string;
  name: string;
  running: boolean;
  path: string;
  port: number;
  pid?: number;
  cpu_percent?: number;
  memory_mb?: number;
}

export interface SystemMetricsPoint {
  ts: number;
  cpu_percent: number;
  ram_used_mb: number;
  ram_total_mb: number;
  ram_percent: number;
}

export interface ServerMetricsPoint {
  ts: number;
  cpu_percent: number;
  mem_mb: number;
}
