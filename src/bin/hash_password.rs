use bcrypt::{hash, DEFAULT_COST};

fn main() {
    let args: Vec<String> = std::env::args().collect();
    
    if args.len() != 2 {
        eprintln!("Usage: cargo run --bin hash_password <password>");
        eprintln!("\nThis tool generates a bcrypt hash for use in config.json");
        eprintln!("Copy the output and set it as the 'password_hash' field in config.json");
        std::process::exit(1);
    }
    
    let password = &args[1];
    
    if password.is_empty() {
        eprintln!("Error: Password cannot be empty");
        std::process::exit(1);
    }
    
    match hash(password, DEFAULT_COST) {
        Ok(hashed) => {
            println!("Bcrypt hash generated successfully:");
            println!("{}", hashed);
            println!("\nAdd this to config.json:");
            println!("\"password_hash\": \"{}\"", hashed);
        }
        Err(e) => {
            eprintln!("Error generating hash: {}", e);
            std::process::exit(1);
        }
    }
}
