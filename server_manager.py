#!/usr/bin/env python3
"""
Minecraft Server Manager - Core Module
Handles server lifecycle, backups, and console management
"""

import os
import json
import subprocess
import signal
import psutil
import time
import shutil
from datetime import datetime
from pathlib import Path


class ServerManager:
    """Manages Minecraft server instances"""
    
    def __init__(self, config_path='config.json'):
        """Initialize the server manager with configuration"""
        self.config_path = config_path
        self.config = self.load_config()
        self.servers_dir = Path(self.config.get('servers_dir', './servers'))
        self.backups_dir = Path(self.config.get('backups_dir', './backups'))
        self.running_processes = {}
        
        # Create directories if they don't exist
        self.servers_dir.mkdir(parents=True, exist_ok=True)
        self.backups_dir.mkdir(parents=True, exist_ok=True)
    
    def load_config(self):
        """Load configuration from JSON file"""
        if os.path.exists(self.config_path):
            with open(self.config_path, 'r') as f:
                return json.load(f)
        else:
            # Return default config if file doesn't exist
            return {
                'servers_dir': './servers',
                'backups_dir': './backups',
                'servers': {}
            }
    
    def save_config(self):
        """Save configuration to JSON file"""
        with open(self.config_path, 'w') as f:
            json.dump(self.config, f, indent=2)
    
    def get_servers(self):
        """Get list of configured servers"""
        return self.config.get('servers', {})
    
    def get_server(self, server_id):
        """Get specific server configuration"""
        servers = self.get_servers()
        return servers.get(server_id)
    
    def is_running(self, server_id):
        """Check if a server is currently running"""
        server = self.get_server(server_id)
        if not server:
            return False
        
        pid_file = Path(server['path']) / 'server.pid'
        if not pid_file.exists():
            return False
        
        try:
            with open(pid_file, 'r') as f:
                pid = int(f.read().strip())
            
            # Check if process is actually running
            if psutil.pid_exists(pid):
                proc = psutil.Process(pid)
                if proc.is_running() and proc.status() != psutil.STATUS_ZOMBIE:
                    return True
        except (ValueError, psutil.NoSuchProcess):
            pass
        
        # Clean up stale PID file
        if pid_file.exists():
            pid_file.unlink()
        
        return False
    
    def start_server(self, server_id):
        """Start a Minecraft server"""
        server = self.get_server(server_id)
        if not server:
            return False, f"Server '{server_id}' not found in configuration"
        
        if self.is_running(server_id):
            return False, f"Server '{server_id}' is already running"
        
        server_path = Path(server['path'])
        if not server_path.exists():
            server_path.mkdir(parents=True, exist_ok=True)
        
        jar_file = server_path / server.get('jar', 'server.jar')
        if not jar_file.exists():
            return False, f"Server jar not found at {jar_file}"
        
        # Create logs directory
        log_dir = server_path / 'logs'
        log_dir.mkdir(exist_ok=True)
        
        # Prepare Java command
        memory = server.get('memory', '2G')
        java_cmd = [
            'java',
            f'-Xmx{memory}',
            f'-Xms{memory}',
            '-jar',
            str(jar_file),
            'nogui'
        ]
        
        # Create log files
        timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        console_log = log_dir / f'console_{timestamp}.log'
        
        # Start the server process
        try:
            with open(console_log, 'w') as log_file:
                process = subprocess.Popen(
                    java_cmd,
                    cwd=str(server_path),
                    stdout=log_file,
                    stderr=subprocess.STDOUT,
                    stdin=subprocess.PIPE,
                    preexec_fn=os.setsid
                )
            
            # Save PID
            pid_file = server_path / 'server.pid'
            with open(pid_file, 'w') as f:
                f.write(str(process.pid))
            
            # Save current console log path
            current_log = server_path / 'current.log'
            with open(current_log, 'w') as f:
                f.write(str(console_log))
            
            return True, f"Server '{server_id}' started successfully (PID: {process.pid})"
        
        except Exception as e:
            return False, f"Failed to start server: {str(e)}"
    
    def stop_server(self, server_id):
        """Stop a Minecraft server"""
        server = self.get_server(server_id)
        if not server:
            return False, f"Server '{server_id}' not found in configuration"
        
        if not self.is_running(server_id):
            return False, f"Server '{server_id}' is not running"
        
        server_path = Path(server['path'])
        pid_file = server_path / 'server.pid'
        
        try:
            with open(pid_file, 'r') as f:
                pid = int(f.read().strip())
            
            # Send stop command to server
            process = psutil.Process(pid)
            
            # Try graceful shutdown first
            try:
                # Send 'stop' command to server stdin if possible
                os.kill(pid, signal.SIGTERM)
                
                # Wait for process to terminate
                for _ in range(30):  # Wait up to 30 seconds
                    if not psutil.pid_exists(pid):
                        break
                    time.sleep(1)
                
                # Force kill if still running
                if psutil.pid_exists(pid):
                    os.kill(pid, signal.SIGKILL)
                    time.sleep(1)
            
            except psutil.NoSuchProcess:
                pass
            
            # Clean up PID file
            if pid_file.exists():
                pid_file.unlink()
            
            return True, f"Server '{server_id}' stopped successfully"
        
        except Exception as e:
            return False, f"Failed to stop server: {str(e)}"
    
    def get_server_status(self, server_id):
        """Get detailed status of a server"""
        server = self.get_server(server_id)
        if not server:
            return None
        
        status = {
            'id': server_id,
            'name': server.get('name', server_id),
            'running': self.is_running(server_id),
            'path': server['path'],
            'port': server.get('port', 25565)
        }
        
        if status['running']:
            pid_file = Path(server['path']) / 'server.pid'
            try:
                with open(pid_file, 'r') as f:
                    pid = int(f.read().strip())
                proc = psutil.Process(pid)
                status['pid'] = pid
                status['cpu_percent'] = proc.cpu_percent(interval=0.1)
                status['memory_mb'] = proc.memory_info().rss / 1024 / 1024
            except:
                pass
        
        return status
    
    def get_console_output(self, server_id, lines=50):
        """Get recent console output from a server"""
        server = self.get_server(server_id)
        if not server:
            return None
        
        server_path = Path(server['path'])
        current_log = server_path / 'current.log'
        
        if not current_log.exists():
            return []
        
        try:
            with open(current_log, 'r') as f:
                log_path = f.read().strip()
            
            if not os.path.exists(log_path):
                return []
            
            with open(log_path, 'r') as f:
                all_lines = f.readlines()
                return all_lines[-lines:] if len(all_lines) > lines else all_lines
        
        except Exception as e:
            return [f"Error reading console: {str(e)}"]
    
    def create_backup(self, server_id):
        """Create a backup of a server"""
        server = self.get_server(server_id)
        if not server:
            return False, f"Server '{server_id}' not found in configuration"
        
        server_path = Path(server['path'])
        if not server_path.exists():
            return False, f"Server directory not found: {server_path}"
        
        # Create backup filename with timestamp
        timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        backup_name = f"{server_id}_{timestamp}"
        backup_path = self.backups_dir / backup_name
        
        try:
            # Create backup
            shutil.copytree(server_path, backup_path, 
                          ignore=shutil.ignore_patterns('*.pid', 'current.log'))
            
            return True, f"Backup created: {backup_name}"
        
        except Exception as e:
            return False, f"Failed to create backup: {str(e)}"
    
    def list_backups(self, server_id=None):
        """List available backups"""
        backups = []
        
        if not self.backups_dir.exists():
            return backups
        
        for backup in sorted(self.backups_dir.iterdir(), reverse=True):
            if backup.is_dir():
                if server_id is None or backup.name.startswith(f"{server_id}_"):
                    backups.append({
                        'name': backup.name,
                        'path': str(backup),
                        'created': datetime.fromtimestamp(backup.stat().st_mtime).isoformat(),
                        'size_mb': sum(f.stat().st_size for f in backup.rglob('*') if f.is_file()) / 1024 / 1024
                    })
        
        return backups
