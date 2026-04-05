# Minecraft Server Manager

A web-based management interface for Minecraft servers with real-time monitoring, console access, and session-based authentication.

## Features

- **Web UI**: Modern web interface for managing multiple Minecraft servers
- **Real-time Metrics**: Live CPU and memory usage charts via WebSockets
- **Console Access**: Interactive console with command execution
- **Server Management**: Start, stop, restart, and backup servers
- **Authentication**: Session-based password protection with bcrypt hashing
- **Security**: Rate limiting, secure cookies, and security headers

## Quick Start

### 1. Generate Password Hash

First, generate a bcrypt hash for your password:

```bash
cargo run --bin hash_password YourSecurePassword
```

Copy the output hash (starts with `$2b$`).

### 2. Configure

Edit `config.json`:

```json
{
  "agent": {
    "bind_address": "0.0.0.0:8080",
    "data_directory": "/servers",
    "password_hash": "$2b$12$...",
    "session_timeout_hours": 24,
    "max_login_attempts": 5
  },
  "servers": [
    {
      "id": "survival",
      "name": "Survival Server",
      "directory": "/servers/survival",
      "jar": "server.jar",
      "memory_mb": 4096,
      "port": 25565,
      "autostart": false,
      "backup_directory": "/backups/survival"
    }
  ]
}
```

### 3. Build and Run

```bash
cargo build --release
cargo run --bin minecraft-manager
```

The server will start on `http://0.0.0.0:8080`

### 4. Access the Web UI

1. Navigate to `http://localhost:8080`
2. You'll be redirected to `/login.html`
3. Enter your password
4. Once authenticated, you can manage your servers

## Authentication

### Security Features

- **Bcrypt Password Hashing**: Passwords are never stored in plaintext
- **Session-based Auth**: Cookies with `HttpOnly` and `SameSite=Strict`
- **Session Timeout**: Configurable timeout (default: 24 hours)
- **Rate Limiting**: Prevents brute force attacks (configured via `max_login_attempts`)
- **Security Headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection

### Changing Your Password

1. Generate a new hash:
   ```bash
   cargo run --bin hash_password NewPassword
   ```

2. Update `password_hash` in `config.json`

3. Restart the server

### If You're Locked Out

If you forget your password:

1. Stop the server
2. Generate a new password hash
3. Update `config.json` with the new hash
4. Start the server

## Configuration Reference

### Agent Configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `bind_address` | string | `"0.0.0.0:8080"` | Address and port to listen on |
| `data_directory` | string | `"/servers"` | Base directory for server data |
| `password_hash` | string | *required* | Bcrypt hash of your password |
| `session_timeout_hours` | number | `24` | Hours before session expires |
| `max_login_attempts` | number | `5` | Max failed login attempts (per 15 min) |

### Server Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier |
| `name` | string | Yes | Display name |
| `directory` | string | Yes | Server directory path |
| `jar` | string | Yes | JAR filename (e.g., `server.jar`) |
| `memory_mb` | number | Yes | RAM allocation (512-32768 MB) |
| `port` | number | Yes | Server port (1024-65535) |
| `autostart` | boolean | Yes | Start on agent startup |
| `backup_directory` | string | No | Backup destination path |

## API Endpoints

### Authentication

- `POST /api/auth/login` - Login with password
- `POST /api/auth/logout` - Logout and clear session
- `GET /api/auth/status` - Check authentication status

### Servers (Require Authentication)

- `GET /api/servers` - List all servers
- `POST /api/servers` - Create new server
- `PUT /api/servers/{id}` - Update server config
- `DELETE /api/servers/{id}` - Delete server
- `POST /api/servers/{id}/start` - Start server
- `POST /api/servers/{id}/stop` - Stop server
- `POST /api/servers/{id}/restart` - Restart server
- `POST /api/servers/{id}/backup` - Create backup
- `GET /api/servers/{id}/console/ws` - WebSocket console stream
- `GET /api/servers/{id}/metrics/ws` - WebSocket metrics stream

## Security Best Practices

1. **Change Default Password**: Always generate your own unique password hash
2. **Use Strong Passwords**: Minimum 12 characters with mixed case, numbers, and symbols
3. **Secure Your Network**: Run behind a firewall or use a reverse proxy with HTTPS
4. **Regular Updates**: Keep dependencies updated for security patches
5. **Backup Regularly**: Use the backup feature to protect server data
6. **Monitor Logs**: Check logs for suspicious login attempts

## Troubleshooting

### Server Won't Start

Check that:
- Port 8080 is not already in use
- `config.json` has valid syntax
- `password_hash` is a valid bcrypt hash (starts with `$2b$`, `$2a$`, or `$2y$`)

### Can't Login

- Verify you're using the correct password
- Check server logs for authentication errors
- If locked out, regenerate password hash and update config

### Session Expires Too Quickly

Increase `session_timeout_hours` in `config.json`

### WebSocket Connection Fails

- Ensure you're authenticated first
- Check browser console for errors
- Verify server is running and accessible

## Development

### Build

```bash
cargo build
```

### Run Tests

```bash
cargo test
```

### Generate Documentation

```bash
cargo doc --open
```

## License

See LICENSE file for details.

## Support

For issues and questions, check the project repository.