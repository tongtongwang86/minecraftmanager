#!/usr/bin/env node

/**
 * Minecraft Server Manager - CLI Tool
 * Command-line interface for managing Minecraft servers
 */

import { Command } from 'commander';
import { ServerManager } from './lib/server-manager-cli.js';

const program = new Command();

program
  .name('mcm')
  .description('Minecraft Server Manager - CLI Tool')
  .version('1.0.0')
  .option('-c, --config <path>', 'Path to configuration file', 'config.json');

// List command
program
  .command('list')
  .description('List all servers')
  .action((options) => {
    const manager = new ServerManager(program.opts().config);
    const servers = manager.getServers();

    if (Object.keys(servers).length === 0) {
      console.log('No servers configured.');
      return;
    }

    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                        SERVER LIST                            ║');
    console.log('╠══════════╦═══════════════════╦═══════════╦═══════╦════════════╣');
    console.log('║ ID       ║ Name              ║ Status    ║ Port  ║ Memory     ║');
    console.log('╠══════════╬═══════════════════╬═══════════╬═══════╬════════════╣');

    for (const [serverId, server] of Object.entries(servers)) {
      const status = manager.getServerStatus(serverId);
      const running = status.running ? '✓ Running' : '✗ Stopped';
      const memory = status.running && status.memory_mb 
        ? `${status.memory_mb.toFixed(1)} MB` 
        : '-';

      console.log(
        `║ ${serverId.padEnd(8)} ║ ${(server.name || serverId).padEnd(17)} ║ ${running.padEnd(9)} ║ ${server.port.toString().padEnd(5)} ║ ${memory.padEnd(10)} ║`
      );
    }

    console.log('╚══════════╩═══════════════════╩═══════════╩═══════╩════════════╝\n');
  });

// Start command
program
  .command('start')
  .description('Start a server')
  .argument('<server_id>', 'Server ID to start')
  .action((serverId) => {
    const manager = new ServerManager(program.opts().config);
    const result = manager.startServer(serverId);
    console.log(result.message);
    process.exit(result.success ? 0 : 1);
  });

// Stop command
program
  .command('stop')
  .description('Stop a server')
  .argument('<server_id>', 'Server ID to stop')
  .action((serverId) => {
    const manager = new ServerManager(program.opts().config);
    const result = manager.stopServer(serverId);
    console.log(result.message);
    process.exit(result.success ? 0 : 1);
  });

// Status command
program
  .command('status')
  .description('Show server status')
  .argument('<server_id>', 'Server ID')
  .action((serverId) => {
    const manager = new ServerManager(program.opts().config);
    const status = manager.getServerStatus(serverId);

    if (!status) {
      console.log(`Server '${serverId}' not found`);
      process.exit(1);
    }

    console.log(`\nServer: ${status.name}`);
    console.log(`ID: ${status.id}`);
    console.log(`Status: ${status.running ? 'Running' : 'Stopped'}`);
    console.log(`Path: ${status.path}`);
    console.log(`Port: ${status.port}`);

    if (status.running) {
      console.log(`PID: ${status.pid || 'N/A'}`);
      console.log(`CPU: ${status.cpu_percent ? status.cpu_percent.toFixed(1) : '0.0'}%`);
      console.log(`Memory: ${status.memory_mb ? status.memory_mb.toFixed(1) : '0.0'} MB`);
    }

    console.log();
    process.exit(0);
  });

// Console command
program
  .command('console')
  .description('View server console output')
  .argument('<server_id>', 'Server ID')
  .option('-n, --lines <number>', 'Number of lines to show', '50')
  .action((serverId, options) => {
    const manager = new ServerManager(program.opts().config);
    const lines = parseInt(options.lines);
    const output = manager.getConsoleOutput(serverId, lines);

    if (output === null) {
      console.log(`Server '${serverId}' not found`);
      process.exit(1);
    }

    if (output.length === 0) {
      console.log(`No console output available for '${serverId}'`);
      process.exit(0);
    }

    console.log(`\n=== Console output for '${serverId}' (last ${lines} lines) ===\n`);
    output.forEach(line => process.stdout.write(line));
    process.exit(0);
  });

// Backup command
program
  .command('backup')
  .description('Create a server backup')
  .argument('<server_id>', 'Server ID to backup')
  .action((serverId) => {
    const manager = new ServerManager(program.opts().config);
    const result = manager.createBackup(serverId);
    console.log(result.message);
    process.exit(result.success ? 0 : 1);
  });

// Backups command
program
  .command('backups')
  .description('List backups')
  .argument('[server_id]', 'Server ID (optional)')
  .action((serverId) => {
    const manager = new ServerManager(program.opts().config);
    const backups = manager.listBackups(serverId);

    if (backups.length === 0) {
      console.log('No backups found.');
      process.exit(0);
    }

    console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║                          BACKUPS LIST                             ║');
    console.log('╠═══════════════════════════════╦═══════════════════════╦═══════════╣');
    console.log('║ Backup Name                   ║ Created               ║ Size      ║');
    console.log('╠═══════════════════════════════╬═══════════════════════╬═══════════╣');

    backups.forEach(backup => {
      const created = new Date(backup.created).toLocaleString();
      console.log(
        `║ ${backup.name.padEnd(29)} ║ ${created.padEnd(21)} ║ ${(backup.size_mb.toFixed(1) + ' MB').padEnd(9)} ║`
      );
    });

    console.log('╚═══════════════════════════════╩═══════════════════════╩═══════════╝\n');
    process.exit(0);
  });

program.parse();
