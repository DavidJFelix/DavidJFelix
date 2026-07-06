#[derive(Debug, PartialEq)]
enum Operations {
    Add,
    Multiply,
    Exit,
}

fn main() {
    println!("Hello, world!");
}

fn parse_opcode(opcode: u64) -> Result<Operations, &'static str> {
    match opcode {
        1 => Ok(Operations::Add),
        2 => Ok(Operations::Multiply),
        99 => Ok(Operations::Exit),
        _ => Err("unknown operation"),
    }
}

#[test]
fn test_parse_opcode() {
    assert_eq!(parse_opcode(1), Ok(Operations::Add));
    assert_eq!(parse_opcode(2), Ok(Operations::Multiply));
    assert_eq!(parse_opcode(99), Ok(Operations::Exit));
    assert_eq!(parse_opcode(0), Err("unknown operation"));
    assert_eq!(parse_opcode(200), Err("unknown operation"));
    assert_eq!(parse_opcode(98), Err("unknown operation"));
    assert_eq!(parse_opcode(1000000), Err("unknown operation"));
}