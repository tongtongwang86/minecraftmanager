mod config;
mod state;
mod process;
mod api;

use axum::{
    routing::{delete, get, post, put},
    Router,
};
use tower_http::cors::CorsLayer;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let cfg = config::load_config().await?;
    let bind_address = cfg.agent.bind_address.clone();

    let state = state::AppState::new(cfg.clone());

    // Autostart servers
    for server in &cfg.servers {
        if server.autostart {
            let state2 = state.clone();
            let id = server.id.clone();
            tokio::spawn(async move {
                if let Err(e) = process::start_server(state2, &id).await {
                    tracing::error!("Autostart failed for '{}': {}", id, e);
                }
            });
        }
    }

    let app = Router::new()
        .route("/api/servers", get(api::list_servers))
        .route("/api/servers", post(api::create_server))
        .route("/api/servers/:id", put(api::update_server))
        .route("/api/servers/:id", delete(api::delete_server))
        .route("/api/servers/:id/start", post(api::start_server_handler))
        .route("/api/servers/:id/stop", post(api::stop_server_handler))
        .route("/api/servers/:id/restart", post(api::restart_server_handler))
        .route("/api/servers/:id/console/ws", get(api::console_ws))
        .route("/api/servers/:id/metrics/ws", get(api::metrics_ws))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(&bind_address).await?;
    tracing::info!("Listening on {}", bind_address);
    axum::serve(listener, app).await?;

    Ok(())
}

