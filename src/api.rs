use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use tokio::io::AsyncWriteExt;

use crate::{
    config::{save_config, validate_server_config, ServerConfig},
    process::{restart_server, start_server, stop_server},
    state::AppState,
};

#[derive(Serialize)]
pub struct ServerStatus {
    #[serde(flatten)]
    pub config: ServerConfig,
    pub status: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pid: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uptime_seconds: Option<u64>,
}

#[derive(Serialize)]
struct ApiError {
    error: String,
}

fn err_response(status: StatusCode, msg: impl Into<String>) -> impl IntoResponse {
    (status, Json(ApiError { error: msg.into() }))
}

pub async fn list_servers(State(state): State<AppState>) -> impl IntoResponse {
    let config = state.config.read().await;
    let result: Vec<ServerStatus> = config
        .servers
        .iter()
        .map(|cfg| {
            if let Some(inst) = state.servers.get(&cfg.id) {
                ServerStatus {
                    config: cfg.clone(),
                    status: "running",
                    pid: Some(inst.pid),
                    uptime_seconds: Some(inst.started_at.elapsed().as_secs()),
                }
            } else {
                ServerStatus {
                    config: cfg.clone(),
                    status: "stopped",
                    pid: None,
                    uptime_seconds: None,
                }
            }
        })
        .collect();
    Json(result)
}

pub async fn create_server(
    State(state): State<AppState>,
    Json(input): Json<ServerConfig>,
) -> impl IntoResponse {
    {
        let config = state.config.read().await;
        if config.servers.iter().any(|s| s.id == input.id) {
            return err_response(StatusCode::CONFLICT, format!("Server id '{}' already exists", input.id))
                .into_response();
        }
    }
    if let Err(e) = validate_server_config(&input) {
        return err_response(StatusCode::BAD_REQUEST, e).into_response();
    }
    {
        let mut config = state.config.write().await;
        config.servers.push(input);
        if let Err(e) = save_config(&config).await {
            return err_response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
        }
    }
    StatusCode::CREATED.into_response()
}

pub async fn update_server(
    Path(id): Path<String>,
    State(state): State<AppState>,
    Json(input): Json<ServerConfig>,
) -> impl IntoResponse {
    if input.id != id {
        return err_response(StatusCode::BAD_REQUEST, "id in path must match id in body")
            .into_response();
    }
    let is_running = state.servers.contains_key(&id);
    {
        let config = state.config.read().await;
        let existing = match config.servers.iter().find(|s| s.id == id) {
            Some(s) => s,
            None => {
                return err_response(StatusCode::NOT_FOUND, format!("Server '{}' not found", id))
                    .into_response()
            }
        };
        if is_running && (existing.directory != input.directory || existing.port != input.port) {
            return err_response(
                StatusCode::CONFLICT,
                "Cannot change directory or port while server is running",
            )
            .into_response();
        }
    }
    if let Err(e) = validate_server_config(&input) {
        return err_response(StatusCode::BAD_REQUEST, e).into_response();
    }
    {
        let mut config = state.config.write().await;
        if let Some(s) = config.servers.iter_mut().find(|s| s.id == id) {
            *s = input;
        }
        if let Err(e) = save_config(&config).await {
            return err_response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
        }
    }
    StatusCode::OK.into_response()
}

pub async fn delete_server(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    if state.servers.contains_key(&id) {
        return err_response(StatusCode::CONFLICT, "Server must be stopped before deletion")
            .into_response();
    }
    {
        let mut config = state.config.write().await;
        let before = config.servers.len();
        config.servers.retain(|s| s.id != id);
        if config.servers.len() == before {
            return err_response(StatusCode::NOT_FOUND, format!("Server '{}' not found", id))
                .into_response();
        }
        if let Err(e) = save_config(&config).await {
            return err_response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
        }
    }
    StatusCode::NO_CONTENT.into_response()
}

pub async fn start_server_handler(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    match start_server(state, &id).await {
        Ok(()) => StatusCode::OK.into_response(),
        Err(e) => err_response(StatusCode::BAD_REQUEST, e).into_response(),
    }
}

pub async fn stop_server_handler(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    match stop_server(state, &id).await {
        Ok(()) => StatusCode::OK.into_response(),
        Err(e) => err_response(StatusCode::BAD_REQUEST, e).into_response(),
    }
}

pub async fn restart_server_handler(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    match restart_server(state, &id).await {
        Ok(()) => StatusCode::OK.into_response(),
        Err(e) => err_response(StatusCode::BAD_REQUEST, e).into_response(),
    }
}

pub async fn console_ws(
    ws: WebSocketUpgrade,
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_console_ws(socket, id, state))
}

async fn handle_console_ws(mut socket: WebSocket, id: String, state: AppState) {
    let instance = match state.servers.get(&id).map(|r| r.value().clone()) {
        Some(i) => i,
        None => {
            let _ = socket
                .send(Message::Text("Server is not running".to_string().into()))
                .await;
            return;
        }
    };

    // Send buffered lines
    {
        let buf = instance.console_buffer.lock().await;
        let recent: Vec<String> = buf.iter().rev().take(100).cloned().collect();
        for line in recent.into_iter().rev() {
            if socket.send(Message::Text(line.into())).await.is_err() {
                return;
            }
        }
    }

    let mut console_rx = instance.console_tx.subscribe();

    loop {
        tokio::select! {
            msg = console_rx.recv() => {
                match msg {
                    Ok(line) => {
                        if socket.send(Message::Text(line.into())).await.is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
            ws_msg = socket.recv() => {
                match ws_msg {
                    Some(Ok(Message::Text(text))) => {
                        #[derive(Deserialize)]
                        struct WsCommand {
                            #[serde(rename = "type")]
                            kind: String,
                            data: String,
                        }
                        if let Ok(cmd) = serde_json::from_str::<WsCommand>(&text) {
                            if cmd.kind == "command" {
                                let mut stdin = instance.stdin.lock().await;
                                let line = format!("{}\n", cmd.data);
                                let _ = stdin.write_all(line.as_bytes()).await;
                                let _ = stdin.flush().await;
                            }
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    _ => {}
                }
            }
        }
    }
}

pub async fn metrics_ws(
    ws: WebSocketUpgrade,
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_metrics_ws(socket, id, state))
}

async fn handle_metrics_ws(mut socket: WebSocket, id: String, state: AppState) {
    let instance = match state.servers.get(&id).map(|r| r.value().clone()) {
        Some(i) => i,
        None => {
            let _ = socket
                .send(Message::Text("Server is not running".to_string().into()))
                .await;
            return;
        }
    };

    let mut metrics_rx = instance.metrics_tx.subscribe();
    loop {
        match metrics_rx.recv().await {
            Ok(metrics) => {
                if let Ok(json) = serde_json::to_string(&metrics) {
                    if socket.send(Message::Text(json.into())).await.is_err() {
                        break;
                    }
                }
            }
            Err(_) => break,
        }
    }
}
