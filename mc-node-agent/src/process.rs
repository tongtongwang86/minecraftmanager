use crate::config::validate_server_config;
use crate::state::{AppState, Metrics, ServerInstance};
use std::collections::VecDeque;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use sysinfo::{Pid, System};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::{broadcast, Mutex};

pub async fn start_server(state: AppState, server_id: &str) -> Result<(), String> {
    if state.servers.contains_key(server_id) {
        return Err(format!("Server '{}' is already running", server_id));
    }

    let server_cfg = {
        let config = state.config.read().await;
        config
            .servers
            .iter()
            .find(|s| s.id == server_id)
            .cloned()
            .ok_or_else(|| format!("Server '{}' not found in config", server_id))?
    };

    validate_server_config(&server_cfg).map_err(|e| format!("Invalid config: {}", e))?;

    let mut cmd = tokio::process::Command::new("java");
    cmd.arg(format!("-Xmx{}M", server_cfg.memory_mb))
        .arg("-jar")
        .arg(&server_cfg.jar)
        .arg("nogui")
        .current_dir(&server_cfg.directory)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn java: {}", e))?;

    let pid = child.id().ok_or("Failed to get child PID")?;
    let stdin = child
        .stdin
        .take()
        .ok_or("Failed to get child stdin")?;
    let stdout = child
        .stdout
        .take()
        .ok_or("Failed to get child stdout")?;
    let stderr = child
        .stderr
        .take()
        .ok_or("Failed to get child stderr")?;

    let (metrics_tx, _) = broadcast::channel(64);
    let (console_tx, _) = broadcast::channel(256);

    let instance = Arc::new(ServerInstance {
        id: server_id.to_string(),
        pid,
        child: Mutex::new(child),
        stdin: Mutex::new(stdin),
        metrics_tx: metrics_tx.clone(),
        console_tx: console_tx.clone(),
        started_at: std::time::Instant::now(),
        console_buffer: Mutex::new(VecDeque::new()),
    });

    state.servers.insert(server_id.to_string(), instance.clone());

    // Spawn console reader for stdout
    {
        let state2 = state.clone();
        let sid = server_id.to_string();
        let console_tx2 = console_tx.clone();
        let instance2 = instance.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let _ = console_tx2.send(line.clone());
                let mut buf = instance2.console_buffer.lock().await;
                buf.push_back(line);
                if buf.len() > 500 {
                    buf.pop_front();
                }
            }
            on_process_exit(&state2, &sid).await;
        });
    }

    // Spawn console reader for stderr
    {
        let state2 = state.clone();
        let sid = server_id.to_string();
        let console_tx3 = console_tx.clone();
        let instance3 = instance.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let _ = console_tx3.send(line.clone());
                let mut buf = instance3.console_buffer.lock().await;
                buf.push_back(line);
                if buf.len() > 500 {
                    buf.pop_front();
                }
            }
            on_process_exit(&state2, &sid).await;
        });
    }

    // Spawn metrics sampler
    {
        let state2 = state.clone();
        let sid = server_id.to_string();
        let metrics_tx2 = metrics_tx.clone();
        tokio::spawn(async move {
            let mut sys = System::new();
            loop {
                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                let alive = sys.refresh_process(Pid::from_u32(pid));
                if !alive {
                    on_process_exit(&state2, &sid).await;
                    break;
                }
                if let Some(proc) = sys.process(Pid::from_u32(pid)) {
                    let cpu = proc.cpu_usage();
                    let mem = proc.memory();
                    let ts = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64;
                    let m = Metrics {
                        cpu_percent: cpu,
                        memory_bytes: mem,
                        timestamp_ms: ts,
                    };
                    let _ = metrics_tx2.send(m);
                }
            }
        });
    }

    tracing::info!("Started server '{}' with PID {}", server_id, pid);
    Ok(())
}

async fn on_process_exit(state: &AppState, server_id: &str) {
    // Idempotent: only first removal triggers autostart
    if state.servers.remove(server_id).is_none() {
        return;
    }
    tracing::info!("Server '{}' exited", server_id);

    let autostart = {
        let config = state.config.read().await;
        config
            .servers
            .iter()
            .find(|s| s.id == server_id)
            .map(|s| s.autostart)
            .unwrap_or(false)
    };

    if autostart {
        let state2 = state.clone();
        let sid = server_id.to_string();
        tokio::spawn(autostart_after_delay(state2, sid));
    }
}

// Separate non-async fn returning BoxFuture to break the opaque-type cycle
// between start_server and on_process_exit.
fn autostart_after_delay(
    state: AppState,
    server_id: String,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>> {
    Box::pin(async move {
        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
        if let Err(e) = start_server(state, &server_id).await {
            tracing::error!("Autostart failed for '{}': {}", server_id, e);
        }
    })
}

pub async fn stop_server(state: AppState, server_id: &str) -> Result<(), String> {
    let instance = state
        .servers
        .get(server_id)
        .map(|r| r.value().clone())
        .ok_or_else(|| format!("Server '{}' is not running", server_id))?;

    // Send "stop" command
    {
        let mut stdin = instance.stdin.lock().await;
        let _ = stdin.write_all(b"stop\n").await;
        let _ = stdin.flush().await;
    }

    // Wait up to 15 seconds
    let mut stopped = false;
    for _ in 0..30 {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        let mut child = instance.child.lock().await;
        match child.try_wait() {
            Ok(Some(_)) => {
                stopped = true;
                break;
            }
            Ok(None) => {}
            Err(e) => {
                tracing::warn!("try_wait error for '{}': {}", server_id, e);
            }
        }
    }

    if !stopped {
        // SIGTERM
        use nix::sys::signal::{self, Signal};
        use nix::unistd::Pid as NixPid;
        let _ = signal::kill(NixPid::from_raw(instance.pid as i32), Signal::SIGTERM);

        // Wait up to 5 more seconds
        for _ in 0..10 {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            let mut child = instance.child.lock().await;
            match child.try_wait() {
                Ok(Some(_)) => {
                    stopped = true;
                    break;
                }
                _ => {}
            }
        }
    }

    if !stopped {
        let mut child = instance.child.lock().await;
        let _ = child.kill().await;
    }

    state.servers.remove(server_id);
    tracing::info!("Stopped server '{}'", server_id);
    Ok(())
}

pub async fn restart_server(state: AppState, server_id: &str) -> Result<(), String> {
    if state.servers.contains_key(server_id) {
        stop_server(state.clone(), server_id).await?;
    }
    start_server(state, server_id).await
}
