use axum::{
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::Response,
};
use tower_sessions::Session;

use crate::state::AppState;
use super::session::{AuthSession, SESSION_KEY};

pub async fn require_auth(
    State(state): State<AppState>,
    session: Session,
    request: Request<axum::body::Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    // Check if session has authenticated user
    match session.get::<AuthSession>(SESSION_KEY).await {
        Ok(Some(auth_session)) => {
            // Check if session is expired
            let timeout_hours = {
                let config = state.config.read().await;
                config.agent.session_timeout_hours
            };
            
            if auth_session.is_expired(timeout_hours) {
                session.delete().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
                return Err(StatusCode::UNAUTHORIZED);
            }
            
            // Session valid, continue
            Ok(next.run(request).await)
        }
        Ok(None) => {
            // No auth session found
            Err(StatusCode::UNAUTHORIZED)
        }
        Err(_) => {
            // Error reading session
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn security_headers(
    request: Request<axum::body::Body>,
    next: Next,
) -> Response {
    let mut response = next.run(request).await;
    let headers = response.headers_mut();
    
    headers.insert("X-Content-Type-Options", "nosniff".parse().unwrap());
    headers.insert("X-Frame-Options", "DENY".parse().unwrap());
    headers.insert("X-XSS-Protection", "1; mode=block".parse().unwrap());
    
    response
}
