# Minecraft Server Manager

A comprehensive Linux tool for managing Minecraft servers with both CLI and web interface support.

## Features

- 🚀 **Start/Stop Servers**: Easily control your Minecraft servers
- 💾 **Backup Management**: Create and manage server backups
- 📊 **Server Monitoring**: View server status, CPU, and memory usage
- 📺 **Console Viewing**: Monitor server console output in real-time
- 🌐 **Web Interface**: Beautiful web UI for managing servers
- 💻 **CLI Tool**: Command-line interface for automation and scripting

## Requirements

- Python 3.6 or higher
- Java (for running Minecraft servers)
- Linux operating system

## Installation

1. Clone the repository:
```bash
git clone https://github.com/tongtongwang86/minecraftmanager.git
cd minecraftmanager
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Create your configuration file:
```bash
cp config.example.json config.json
```

4. Edit `config.json` to add your servers:
```json
{
  "servers_dir": "./servers",
  "backups_dir": "./backups",
  "web_port": 5000,
  "web_host": "0.0.0.0",
  "servers": {
    "survival": {
      "name": "Survival Server",
      "path": "./servers/survival",
      "jar": "server.jar",
      "memory": "2G",
      "port": 25565,
      "autostart": false
    }
  }
}
```

## Usage

### Web Interface

Start the web interface:
```bash
python3 web.py
```

Then open your browser to `http://localhost:5000`

The web interface provides:
- Real-time server status monitoring
- One-click start/stop controls
- Backup creation
- Live console output viewing
- Auto-refreshing server information

### CLI Tool

The CLI tool (`mcm`) provides command-line access to all features:

#### List all servers:
```bash
./mcm list
```

#### Start a server:
```bash
./mcm start <server_id>
```

#### Stop a server:
```bash
./mcm stop <server_id>
```

#### View server status:
```bash
./mcm status <server_id>
```

#### View console output:
```bash
./mcm console <server_id>
./mcm console <server_id> -n 100  # Show last 100 lines
```

#### Create a backup:
```bash
./mcm backup <server_id>
```

#### List backups:
```bash
./mcm backups
./mcm backups <server_id>  # Filter by server
```

## Configuration

The `config.json` file contains all settings:

- **servers_dir**: Directory where server files are stored
- **backups_dir**: Directory where backups are stored
- **web_port**: Port for the web interface (default: 5000)
- **web_host**: Host for the web interface (default: 0.0.0.0)
- **servers**: Dictionary of server configurations

Each server configuration includes:
- **name**: Display name for the server
- **path**: Path to server directory
- **jar**: Filename of the server JAR file
- **memory**: Maximum memory allocation (e.g., "2G", "4G")
- **port**: Server port number
- **autostart**: Whether to start server automatically (not yet implemented)

## Server Setup

1. Create a server directory:
```bash
mkdir -p servers/myserver
```

2. Download the Minecraft server JAR file to that directory:
```bash
cd servers/myserver
wget https://...minecraft_server.jar -O server.jar
```

3. Accept the EULA:
```bash
echo "eula=true" > eula.txt
```

4. Add the server to your `config.json`

5. Start the server using the web interface or CLI

## Architecture

The project consists of three main components:

1. **server_manager.py**: Core server management logic
   - Server lifecycle management (start/stop)
   - Status monitoring
   - Backup operations
   - Console output capture

2. **mcm**: Command-line interface
   - Built with argparse for easy command handling
   - Formatted output using tabulate
   - Full access to all server management features

3. **web.py**: Flask-based web interface
   - RESTful API endpoints
   - Modern, responsive UI
   - Real-time updates
   - Live console viewing

## File Structure

```
minecraftmanager/
├── server_manager.py      # Core server management module
├── mcm                    # CLI tool (executable)
├── web.py                 # Web interface (executable)
├── templates/
│   └── index.html        # Web UI template
├── config.json           # Configuration file
├── config.example.json   # Example configuration
├── requirements.txt      # Python dependencies
├── servers/              # Server directories (created automatically)
└── backups/              # Backup storage (created automatically)
```

## Security Notes

- The web interface binds to 127.0.0.1 (localhost) by default for security. To allow remote access, change `web_host` to `0.0.0.0` in config.json and ensure you have proper firewall rules in place
- Server console logs may contain sensitive information
- Backup files are stored locally and are not encrypted
- Consider using a reverse proxy (nginx/apache) with authentication for production deployments

## Troubleshooting

### Server won't start
- Ensure Java is installed: `java -version`
- Check that the server JAR file exists
- Verify sufficient memory is available
- Check server logs in the server directory

### Web interface not accessible
- Ensure port 5000 is not blocked by firewall
- Check that no other service is using port 5000
- Verify Flask is installed: `pip list | grep Flask`

### CLI tool not executable
```bash
chmod +x mcm
```

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues.

## License

This project is provided as-is for managing Minecraft servers.
