/**
 * Minecraft Server Manager - Core Module
 * Handles server lifecycle, backups, and console management
 */

import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess, execSync } from 'child_process';

interface ServerConfig {
  name: string;
  path: string;
  jar: string;
  memory: string;
  port: number;
  autostart?: boolean;
}

interface Config {
  servers_dir: string;
  backups_dir: string;
  web_port?: number;
  web_host?: string;
  servers: { [key: string]: ServerConfig };
}

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

interface BackupInfo {
  name: string;
  path: string;
  created: string;
  size_mb: number;
}

export class ServerManager {
  private configPath: string;
  private config: Config;
  private serversDir: string;
  private backupsDir: string;

  constructor(configPath: string = 'config.json') {
    this.configPath = configPath;
    this.config = this.loadConfig();
    this.serversDir = this.config.servers_dir || './servers';
    this.backupsDir = this.config.backups_dir || './backups';

    // Create directories if they don't exist
    if (!fs.existsSync(this.serversDir)) {
      fs.mkdirSync(this.serversDir, { recursive: true });
    }
    if (!fs.existsSync(this.backupsDir)) {
      fs.mkdirSync(this.backupsDir, { recursive: true });
    }
  }

  private loadConfig(): Config {
    if (fs.existsSync(this.configPath)) {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      return JSON.parse(content);
    } else {
      // Return default config if file doesn't exist
      return {
        servers_dir: './servers',
        backups_dir: './backups',
        servers: {}
      };
    }
  }

  saveConfig(): void {
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }

  getServers(): { [key: string]: ServerConfig } {
    return this.config.servers || {};
  }

  getServer(serverId: string): ServerConfig | undefined {
    return this.config.servers?.[serverId];
  }

  isRunning(serverId: string): boolean {
    const server = this.getServer(serverId);
    if (!server) return false;

    const pidFile = path.join(server.path, 'server.pid');
    if (!fs.existsSync(pidFile)) return false;

    try {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim());
      
      // Check if process is actually running using ps command
      try {
        execSync(`ps -p ${pid}`, { stdio: 'ignore' });
        return true;
      } catch {
        // Process doesn't exist, clean up stale PID file
        fs.unlinkSync(pidFile);
        return false;
      }
    } catch {
      return false;
    }
  }

  startServer(serverId: string): { success: boolean; message: string } {
    const server = this.getServer(serverId);
    if (!server) {
      return { success: false, message: `Server '${serverId}' not found in configuration` };
    }

    if (this.isRunning(serverId)) {
      return { success: false, message: `Server '${serverId}' is already running` };
    }

    const serverPath = server.path;
    if (!fs.existsSync(serverPath)) {
      fs.mkdirSync(serverPath, { recursive: true });
    }

    const jarFile = path.join(serverPath, server.jar || 'server.jar');
    if (!fs.existsSync(jarFile)) {
      return { success: false, message: `Server jar not found at ${jarFile}` };
    }

    // Create logs directory
    const logDir = path.join(serverPath, 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Prepare Java command
    const memory = server.memory || '2G';
    const javaArgs = [
      `-Xmx${memory}`,
      `-Xms${memory}`,
      '-jar',
      jarFile,
      'nogui'
    ];

    // Create log file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const consoleLog = path.join(logDir, `console_${timestamp}.log`);

    try {
      // Start the server process
      const logStream = fs.createWriteStream(consoleLog, { flags: 'a' });
      
      const process = spawn('java', javaArgs, {
        cwd: serverPath,
        detached: true,
        stdio: ['ignore', logStream, logStream]
      });

      // Save PID
      const pidFile = path.join(serverPath, 'server.pid');
      fs.writeFileSync(pidFile, process.pid!.toString());

      // Save current console log path
      const currentLog = path.join(serverPath, 'current.log');
      fs.writeFileSync(currentLog, consoleLog);

      // Unref so the parent process can exit
      process.unref();

      return { success: true, message: `Server '${serverId}' started successfully (PID: ${process.pid})` };
    } catch (error) {
      return { success: false, message: `Failed to start server: ${error}` };
    }
  }

  stopServer(serverId: string): { success: boolean; message: string } {
    const server = this.getServer(serverId);
    if (!server) {
      return { success: false, message: `Server '${serverId}' not found in configuration` };
    }

    if (!this.isRunning(serverId)) {
      return { success: false, message: `Server '${serverId}' is not running` };
    }

    const pidFile = path.join(server.path, 'server.pid');

    try {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim());

      // Try graceful shutdown first with SIGTERM
      try {
        process.kill(pid, 'SIGTERM');

        // Wait up to 30 seconds for graceful shutdown
        let attempts = 0;
        const checkInterval = setInterval(() => {
          try {
            process.kill(pid, 0); // Check if process exists
            attempts++;
            if (attempts >= 30) {
              clearInterval(checkInterval);
              // Force kill if still running
              try {
                process.kill(pid, 'SIGKILL');
              } catch {}
            }
          } catch {
            // Process no longer exists
            clearInterval(checkInterval);
          }
        }, 1000);

        // Clean up immediately for the response
        setTimeout(() => {
          if (fs.existsSync(pidFile)) {
            fs.unlinkSync(pidFile);
          }
        }, 2000);

      } catch (error) {
        // Process might already be dead
      }

      return { success: true, message: `Server '${serverId}' stopped successfully` };
    } catch (error) {
      return { success: false, message: `Failed to stop server: ${error}` };
    }
  }

  getServerStatus(serverId: string): ServerStatus | null {
    const server = this.getServer(serverId);
    if (!server) return null;

    const status: ServerStatus = {
      id: serverId,
      name: server.name || serverId,
      running: this.isRunning(serverId),
      path: server.path,
      port: server.port || 25565
    };

    if (status.running) {
      const pidFile = path.join(server.path, 'server.pid');
      try {
        const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim());
        status.pid = pid;

        // Get CPU and memory usage using ps command
        try {
          const psOutput = execSync(`ps -p ${pid} -o %cpu,rss --no-headers`, { encoding: 'utf-8' });
          const [cpu, rss] = psOutput.trim().split(/\s+/);
          status.cpu_percent = parseFloat(cpu);
          status.memory_mb = parseFloat(rss) / 1024; // Convert KB to MB
        } catch {}
      } catch {}
    }

    return status;
  }

  getConsoleOutput(serverId: string, lines: number = 50): string[] | null {
    const server = this.getServer(serverId);
    if (!server) return null;

    const currentLog = path.join(server.path, 'current.log');

    if (!fs.existsSync(currentLog)) {
      return [];
    }

    try {
      const logPath = fs.readFileSync(currentLog, 'utf-8').trim();

      if (!fs.existsSync(logPath)) {
        return [];
      }

      const content = fs.readFileSync(logPath, 'utf-8');
      const allLines = content.split('\n');
      
      return allLines.slice(-lines);
    } catch (error) {
      return [`Error reading console: ${error}`];
    }
  }

  createBackup(serverId: string): { success: boolean; message: string } {
    const server = this.getServer(serverId);
    if (!server) {
      return { success: false, message: `Server '${serverId}' not found in configuration` };
    }

    const serverPath = server.path;
    if (!fs.existsSync(serverPath)) {
      return { success: false, message: `Server directory not found: ${serverPath}` };
    }

    // Create backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupName = `${serverId}_${timestamp}`;
    const backupPath = path.join(this.backupsDir, backupName);

    try {
      // Create backup using cp command
      this.copyDir(serverPath, backupPath, ['*.pid', 'current.log']);

      return { success: true, message: `Backup created: ${backupName}` };
    } catch (error) {
      return { success: false, message: `Failed to create backup: ${error}` };
    }
  }

  private copyDir(src: string, dest: string, ignore: string[] = []): void {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      // Check if should ignore
      if (ignore.some(pattern => {
        if (pattern.startsWith('*')) {
          return entry.name.endsWith(pattern.slice(1));
        }
        return entry.name === pattern;
      })) {
        continue;
      }

      if (entry.isDirectory()) {
        this.copyDir(srcPath, destPath, ignore);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  listBackups(serverId?: string): BackupInfo[] {
    const backups: BackupInfo[] = [];

    if (!fs.existsSync(this.backupsDir)) {
      return backups;
    }

    const entries = fs.readdirSync(this.backupsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!serverId || entry.name.startsWith(`${serverId}_`)) {
          const backupPath = path.join(this.backupsDir, entry.name);
          const stats = fs.statSync(backupPath);
          
          // Calculate directory size
          const size = this.getDirSize(backupPath);

          backups.push({
            name: entry.name,
            path: backupPath,
            created: stats.mtime.toISOString(),
            size_mb: size / (1024 * 1024)
          });
        }
      }
    }

    // Sort by created date, newest first
    backups.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

    return backups;
  }

  private getDirSize(dirPath: string): number {
    let totalSize = 0;

    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else {
          totalSize += fs.statSync(fullPath).size;
        }
      }
    };

    walk(dirPath);
    return totalSize;
  }
}
