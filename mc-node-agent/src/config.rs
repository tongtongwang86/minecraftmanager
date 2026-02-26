use anyhow::Context;
use serde::{Deserialize, Serialize};
use tokio::io::AsyncWriteExt;

pub const CONFIG_PATH: &str = "/config/config.json";
pub const CONFIG_TMP_PATH: &str = "/config/config.json.tmp";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub bind_address: String,
    pub data_directory: String,
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            bind_address: "0.0.0.0:8080".to_string(),
            data_directory: "/servers".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub id: String,
    pub name: String,
    pub directory: String,
    pub jar: String,
    pub memory_mb: u32,
    pub port: u16,
    pub autostart: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Config {
    #[serde(default)]
    pub agent: AgentConfig,
    #[serde(default)]
    pub servers: Vec<ServerConfig>,
}

pub async fn load_config() -> anyhow::Result<Config> {
    match tokio::fs::read_to_string(CONFIG_PATH).await {
        Ok(contents) => {
            let config: Config = serde_json::from_str(&contents)
                .context("Failed to parse config.json")?;
            Ok(config)
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            tracing::info!("Config file not found, using defaults");
            Ok(Config::default())
        }
        Err(e) => Err(e).context("Failed to read config.json"),
    }
}

pub async fn save_config(config: &Config) -> anyhow::Result<()> {
    let json = serde_json::to_string_pretty(config).context("Failed to serialize config")?;
    let mut file = tokio::fs::File::create(CONFIG_TMP_PATH)
        .await
        .context("Failed to create temp config file")?;
    file.write_all(json.as_bytes())
        .await
        .context("Failed to write temp config file")?;
    file.flush().await.context("Failed to flush temp config file")?;
    drop(file);

    // fsync synchronously before rename
    {
        let f = std::fs::File::open(CONFIG_TMP_PATH).context("Failed to open tmp for fsync")?;
        f.sync_all().context("Failed to fsync tmp config file")?;
    }

    tokio::fs::rename(CONFIG_TMP_PATH, CONFIG_PATH)
        .await
        .context("Failed to rename tmp config to final")?;

    Ok(())
}

pub fn validate_server_config(cfg: &ServerConfig) -> Result<(), String> {
    if cfg.memory_mb < 512 || cfg.memory_mb > 32768 {
        return Err("memory_mb must be between 512 and 32768".to_string());
    }
    if cfg.port < 1024 {
        return Err("port must be between 1024 and 65535".to_string());
    }
    if cfg.directory.contains("..") {
        return Err("directory must not contain '..'".to_string());
    }
    if cfg.jar.contains("..") || cfg.jar.contains('/') {
        return Err("jar must not contain '..' or '/'".to_string());
    }
    if cfg.id.contains('/') || cfg.id.contains('\\') || cfg.id.contains("..") {
        return Err("id must not contain '/', '\\', or '..'".to_string());
    }
    if !std::path::Path::new(&cfg.directory).exists() {
        return Err(format!("directory '{}' does not exist", cfg.directory));
    }
    Ok(())
}
