#!/usr/bin/env python3
"""
Minecraft Server Manager - Web Interface
Flask-based web UI for managing Minecraft servers
"""

from flask import Flask, render_template, jsonify, request, send_from_directory
from server_manager import ServerManager
import os
from pathlib import Path

app = Flask(__name__)
manager = ServerManager()

# Load configuration
config = manager.load_config()
# Default to localhost for security - can be changed in config.json
web_host = config.get('web_host', '127.0.0.1')
web_port = config.get('web_port', 5000)


@app.route('/')
def index():
    """Main page"""
    return render_template('index.html')


@app.route('/api/servers')
def api_servers():
    """Get list of all servers with their status"""
    servers = manager.get_servers()
    result = []
    
    for server_id, server_config in servers.items():
        status = manager.get_server_status(server_id)
        result.append(status)
    
    return jsonify(result)


@app.route('/api/servers/<server_id>')
def api_server(server_id):
    """Get detailed information about a specific server"""
    status = manager.get_server_status(server_id)
    
    if not status:
        return jsonify({'error': 'Server not found'}), 404
    
    return jsonify(status)


@app.route('/api/servers/<server_id>/start', methods=['POST'])
def api_start_server(server_id):
    """Start a server"""
    success, message = manager.start_server(server_id)
    
    return jsonify({
        'success': success,
        'message': message
    })


@app.route('/api/servers/<server_id>/stop', methods=['POST'])
def api_stop_server(server_id):
    """Stop a server"""
    success, message = manager.stop_server(server_id)
    
    return jsonify({
        'success': success,
        'message': message
    })


@app.route('/api/servers/<server_id>/console')
def api_console(server_id):
    """Get console output for a server"""
    lines = request.args.get('lines', 100, type=int)
    output = manager.get_console_output(server_id, lines=lines)
    
    if output is None:
        return jsonify({'error': 'Server not found'}), 404
    
    return jsonify({
        'output': ''.join(output)
    })


@app.route('/api/servers/<server_id>/backup', methods=['POST'])
def api_backup_server(server_id):
    """Create a backup of a server"""
    success, message = manager.create_backup(server_id)
    
    return jsonify({
        'success': success,
        'message': message
    })


@app.route('/api/backups')
def api_backups():
    """List all backups"""
    server_id = request.args.get('server_id')
    backups = manager.list_backups(server_id)
    
    return jsonify(backups)


def main():
    """Run the web server"""
    # Create templates directory if it doesn't exist
    templates_dir = Path(__file__).parent / 'templates'
    templates_dir.mkdir(exist_ok=True)
    
    print(f"Starting Minecraft Server Manager Web Interface")
    print(f"Access the interface at http://{web_host}:{web_port}")
    
    app.run(host=web_host, port=web_port, debug=False)


if __name__ == '__main__':
    main()
