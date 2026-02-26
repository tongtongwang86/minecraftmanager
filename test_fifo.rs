use std::fs::OpenOptions;
use std::process::Command;

fn main() {
    let fifo_path = "test2.fifo";
    let _ = std::fs::remove_file(fifo_path);
    Command::new("mkfifo").arg(fifo_path).status().unwrap();
    
    let stdin_file = OpenOptions::new().read(true).write(true).open(fifo_path).unwrap();
    let stdout_file = OpenOptions::new().create(true).append(true).open("test2.log").unwrap();
    
    let mut child = Command::new("cat")
        .stdin(std::process::Stdio::from(stdin_file))
        .stdout(std::process::Stdio::from(stdout_file))
        .spawn()
        .unwrap();
        
    println!("Spawned cat with PID {}", child.id());
}
