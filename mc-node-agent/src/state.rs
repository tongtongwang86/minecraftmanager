use dashmap::DashMap;
use serde::Serialize;
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::{broadcast, Mutex, RwLock};

#[derive(Debug, Clone, Serialize)]
pub struct Metrics {
    pub cpu_percent: f32,
    pub memory_bytes: u64,
    pub timestamp_ms: u64,
}

pub struct ServerInstance {
    pub id: String,
    pub pid: u32,
    pub child: Mutex<tokio::process::Child>,
    pub stdin: Mutex<tokio::process::ChildStdin>,
    pub metrics_tx: broadcast::Sender<Metrics>,
    pub console_tx: broadcast::Sender<String>,
    pub started_at: std::time::Instant,
    pub console_buffer: Mutex<VecDeque<String>>,
}

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<RwLock<crate::config::Config>>,
    pub servers: Arc<DashMap<String, Arc<ServerInstance>>>,
}

impl AppState {
    pub fn new(config: crate::config::Config) -> Self {
        Self {
            config: Arc::new(RwLock::new(config)),
            servers: Arc::new(DashMap::new()),
        }
    }
}
