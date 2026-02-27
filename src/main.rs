mod config;
mod state;
mod process;
mod api;

use axum::{
    routing::{delete, get, post, put},
    Router,
};
use tower_http::{cors::CorsLayer, services::ServeDir};

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

    // Kill any orphaned servers from a previous crash
    process::kill_orphaned_servers(&cfg).await;

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
        .route("/api/servers/{id}", put(api::update_server))
        .route("/api/servers/{id}", delete(api::delete_server))
        .route("/api/servers/{id}/start", post(api::start_server_handler))
        .route("/api/servers/{id}/stop", post(api::stop_server_handler))
        .route("/api/servers/{id}/restart", post(api::restart_server_handler))
        .route("/api/servers/{id}/backup", post(api::backup_server_handler))
        .route("/api/servers/{id}/console/ws", get(api::console_ws))
        .route("/api/servers/{id}/metrics/ws", get(api::metrics_ws))
        .layer(CorsLayer::permissive())
        .with_state(state.clone())
        .fallback_service(ServeDir::new("public"));

    let listener = tokio::net::TcpListener::bind(&bind_address).await?;
    tracing::info!("Listening on {}", bind_address);
    
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    tracing::info!("Shutting down servers...");
    let server_ids: Vec<String> = state.servers.iter().map(|s| s.key().clone()).collect();
    for id in server_ids {
        let _ = process::stop_server(state.clone(), &id).await;
    }

    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}

