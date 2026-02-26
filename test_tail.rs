use tokio::io::{AsyncBufReadExt, AsyncWriteExt};

#[tokio::main]
async fn main() {
    let mut file = tokio::fs::File::open("test2.log").await.unwrap();
    let mut reader = tokio::io::BufReader::new(file);
    let mut line = String::new();
    
    tokio::spawn(async move {
        loop {
            line.clear();
            match reader.read_line(&mut line).await {
                Ok(0) => {
                    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                }
                Ok(_) => {
                    println!("Read: {}", line.trim_end());
                }
                Err(_) => break,
            }
        }
    });
    
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    let mut out = tokio::fs::OpenOptions::new().append(true).open("test2.log").await.unwrap();
    out.write_all(b"new line\n").await.unwrap();
    
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
}
