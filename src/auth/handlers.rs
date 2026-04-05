use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use tower_sessions::Session;

use crate::state::AppState;
use super::{verify_password, session::{AuthSession, SESSION_KEY}};

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AuthStatusResponse {
    pub authenticated: bool,
}

pub async fn login_handler(
    State(state): State<AppState>,
    session: Session,
    Json(req): Json<LoginRequest>,
) -> impl IntoResponse {
    // Get password hash from config
    let password_hash = {
        let config = state.config.read().await;
        config.agent.password_hash.clone()
    };
    
    // Verify password
    match verify_password(&req.password, &password_hash) {
        Ok(true) => {
            // Password correct, create session
            let auth_session = AuthSession::new();
            
            if let Err(e) = session.insert(SESSION_KEY, auth_session).await {
                tracing::error!("Failed to create session: {}", e);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(LoginResponse {
                        success: false,
                        error: Some("Failed to create session".to_string()),
                    }),
                );
            }
            
            (
                StatusCode::OK,
                Json(LoginResponse {
                    success: true,
                    error: None,
                }),
            )
        }
        Ok(false) => {
            // Wrong password
            (
                StatusCode::UNAUTHORIZED,
                Json(LoginResponse {
                    success: false,
                    error: Some("Invalid password".to_string()),
                }),
            )
        }
        Err(e) => {
            tracing::error!("Password verification error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(LoginResponse {
                    success: false,
                    error: Some("Authentication error".to_string()),
                }),
            )
        }
    }
}

pub async fn logout_handler(
    session: Session,
) -> impl IntoResponse {
    if let Err(e) = session.delete().await {
        tracing::error!("Failed to delete session: {}", e);
        return StatusCode::INTERNAL_SERVER_ERROR;
    }
    
    StatusCode::OK
}

pub async fn check_auth_handler(
    session: Session,
) -> impl IntoResponse {
    match session.get::<AuthSession>(SESSION_KEY).await {
        Ok(Some(_)) => {
            Json(AuthStatusResponse { authenticated: true })
        }
        _ => {
            Json(AuthStatusResponse { authenticated: false })
        }
    }
}
