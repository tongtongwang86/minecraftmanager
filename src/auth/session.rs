use serde::{Deserialize, Serialize};
use time::OffsetDateTime;

pub const SESSION_KEY: &str = "auth_session";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSession {
    pub authenticated: bool,
    pub created_at: i64,
}

impl AuthSession {
    pub fn new() -> Self {
        Self {
            authenticated: true,
            created_at: OffsetDateTime::now_utc().unix_timestamp(),
        }
    }
    
    pub fn is_expired(&self, timeout_hours: u64) -> bool {
        let now = OffsetDateTime::now_utc().unix_timestamp();
        let elapsed_hours = (now - self.created_at) / 3600;
        elapsed_hours >= timeout_hours as i64
    }
}
