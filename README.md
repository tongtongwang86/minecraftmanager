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

- Node.js 18 or higher
- npm (Node Package Manager)
- Java (for running Minecraft servers)
- Linux operating system

## Installation

1. Clone the repository:
```bash
git clone https://github.com/tongtongwang86/minecraftmanager.git
cd minecraftmanager
```

2. Install dependencies:
```bash
npm install
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

Start the web interface in development mode:
```bash
npm run dev
```

Or build and start in production mode:
```bash
npm run build
npm start
```

Then open your browser to `http://localhost:3000`

The web interface provides:
- Real-time server status monitoring
- One-click start/stop controls
- Backup creation
- Live console output viewing
- Auto-refreshing server information

### CLI Tool

The CLI tool (`mcm.js`) provides command-line access to all features:

#### List all servers:
```bash
node mcm.js list
```

#### Start a server:
```bash
node mcm.js start <server_id>
```

#### Stop a server:
```bash
node mcm.js stop <server_id>
```

#### View server status:
```bash
node mcm.js status <server_id>
```

#### View console output:
```bash
node mcm.js console <server_id>
node mcm.js console <server_id> -n 100  # Show last 100 lines
```

#### Create a backup:
```bash
node mcm.js backup <server_id>
```

#### List backups:
```bash
node mcm.js backups
node mcm.js backups <server_id>  # Filter by server
```

## Configuration

The `config.json` file contains all settings:

- **servers_dir**: Directory where server files are stored
- **backups_dir**: Directory where backups are stored
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

1. **lib/server-manager.ts**: Core server management logic (TypeScript/ES Modules)
   - Server lifecycle management (start/stop)
   - Status monitoring
   - Backup operations
   - Console output capture

2. **lib/server-manager-cli.js**: Core server management logic (CommonJS for CLI)
   - Same functionality as TypeScript version but in CommonJS for Node.js CLI

3. **mcm.js**: Command-line interface
   - Built with Commander.js for easy command handling
   - Formatted table output
   - Full access to all server management features

4. **app/**: Next.js web application
   - **app/api/**: API routes for server operations
   - **app/page.tsx**: Main React UI component
   - Modern, responsive UI with Tailwind CSS
   - Real-time updates
   - Live console viewing

## File Structure

```
minecraftmanager/
├── lib/
│   ├── server-manager.ts       # Core module (TypeScript/ES Modules)
│   └── server-manager-cli.js   # Core module (CommonJS for CLI)
├── app/
│   ├── api/                    # Next.js API routes
│   │   ├── servers/
│   │   │   ├── route.ts        # List servers
│   │   │   └── [serverId]/
│   │   │       ├── route.ts    # Server details
│   │   │       ├── start/
│   │   │       ├── stop/
│   │   │       ├── console/
│   │   │       └── backup/
│   │   └── backups/
│   │       └── route.ts        # List backups
│   ├── page.tsx                # Main UI page
│   ├── layout.tsx              # Root layout
│   └── globals.css             # Global styles
├── mcm.js                      # CLI tool (executable)
├── next.config.ts              # Next.js configuration
├── tailwind.config.js          # Tailwind CSS configuration
├── tsconfig.json               # TypeScript configuration
├── package.json                # Node.js dependencies
├── config.json                 # Configuration file
├── config.example.json         # Example configuration
├── servers/                    # Server directories (created automatically)
└── backups/                    # Backup storage (created automatically)
```

## Security Notes

- The web interface binds to localhost (127.0.0.1) by default for security. To allow remote access, you can configure Next.js to bind to 0.0.0.0 and ensure you have proper firewall rules in place
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
- Ensure port 3000 is not blocked by firewall
- Check that no other service is using port 3000
- Verify Node.js and dependencies are installed: `npm list`

### CLI tool not executable
```bash
chmod +x mcm.js
```

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues.

## License

This project is provided as-is for managing Minecraft servers.
