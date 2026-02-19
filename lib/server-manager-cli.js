/**
 * Minecraft Server Manager - Core Module (ES Modules)
 * Handles server lifecycle, backups, and console management
 */

import fs from 'fs';
import path from 'path';
import { spawn, execSync } from 'child_process';

export class ServerManager {
  constructor(configPath = 'config.json') {
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

  loadConfig() {
    if (fs.existsSync(this.configPath)) {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      return JSON.parse(content);
    } else {
      return {
        servers_dir: './servers',
        backups_dir: './backups',
        servers: {}
      };
    }
  }

  saveConfig() {
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }

  getServers() {
    return this.config.servers || {};
  }

  getServer(serverId) {
    return this.config.servers?.[serverId];
  }

  isRunning(serverId) {
    const server = this.getServer(serverId);
    if (!server) return false;

    const pidFile = path.join(server.path, 'server.pid');
    if (!fs.existsSync(pidFile)) return false;

    try {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim());
      
      try {
        execSync(`ps -p ${pid}`, { stdio: 'ignore' });
        return true;
      } catch {
        fs.unlinkSync(pidFile);
        return false;
      }
    } catch {
      return false;
    }
  }

  startServer(serverId) {
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

    const logDir = path.join(serverPath, 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const memory = server.memory || '2G';
    const javaArgs = [
      `-Xmx${memory}`,
      `-Xms${memory}`,
      '-jar',
      jarFile,
      'nogui'
    ];

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const consoleLog = path.join(logDir, `console_${timestamp}.log`);

    try {
      const logStream = fs.createWriteStream(consoleLog, { flags: 'a' });
      
      const process = spawn('java', javaArgs, {
        cwd: serverPath,
        detached: true,
        stdio: ['ignore', logStream, logStream]
      });

      const pidFile = path.join(serverPath, 'server.pid');
      fs.writeFileSync(pidFile, process.pid.toString());

      const currentLog = path.join(serverPath, 'current.log');
      fs.writeFileSync(currentLog, consoleLog);

      process.unref();

      return { success: true, message: `Server '${serverId}' started successfully (PID: ${process.pid})` };
    } catch (error) {
      return { success: false, message: `Failed to start server: ${error}` };
    }
  }

  stopServer(serverId) {
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

      try {
        process.kill(pid, 'SIGTERM');

        setTimeout(() => {
          try {
            process.kill(pid, 'SIGKILL');
          } catch {}
          if (fs.existsSync(pidFile)) {
            fs.unlinkSync(pidFile);
          }
        }, 30000);

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

  getServerStatus(serverId) {
    const server = this.getServer(serverId);
    if (!server) return null;

    const status = {
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

        try {
          const psOutput = execSync(`ps -p ${pid} -o %cpu,rss --no-headers`, { encoding: 'utf-8' });
          const [cpu, rss] = psOutput.trim().split(/\s+/);
          status.cpu_percent = parseFloat(cpu);
          status.memory_mb = parseFloat(rss) / 1024;
        } catch {}
      } catch {}
    }

    return status;
  }

  getConsoleOutput(serverId, lines = 50) {
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

  createBackup(serverId) {
    const server = this.getServer(serverId);
    if (!server) {
      return { success: false, message: `Server '${serverId}' not found in configuration` };
    }

    const serverPath = server.path;
    if (!fs.existsSync(serverPath)) {
      return { success: false, message: `Server directory not found: ${serverPath}` };
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupName = `${serverId}_${timestamp}`;
    const backupPath = path.join(this.backupsDir, backupName);

    try {
      this.copyDir(serverPath, backupPath, ['*.pid', 'current.log']);
      return { success: true, message: `Backup created: ${backupName}` };
    } catch (error) {
      return { success: false, message: `Failed to create backup: ${error}` };
    }
  }

  copyDir(src, dest, ignore = []) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

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

  listBackups(serverId) {
    const backups = [];

    if (!fs.existsSync(this.backupsDir)) {
      return backups;
    }

    const entries = fs.readdirSync(this.backupsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!serverId || entry.name.startsWith(`${serverId}_`)) {
          const backupPath = path.join(this.backupsDir, entry.name);
          const stats = fs.statSync(backupPath);
          
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

    backups.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

    return backups;
  }

  getDirSize(dirPath) {
    let totalSize = 0;

    const walk = (dir) => {
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
