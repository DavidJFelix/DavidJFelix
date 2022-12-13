use std::fs;

#[derive(Debug)]
enum Direction {
    Left,
    Up,
    Down,
    Right,
}

impl TryFrom<&str> for Direction {
    type Error = color_eyre::Report;

    fn try_from(s: &str) -> Result<Self, Self::Error> {
        match s {
            "L" => Ok(Direction::Left),
            "U" => Ok(Direction::Up),
            "D" => Ok(Direction::Down),
            "R" => Ok(Direction::Right),
            _ => Err(color_eyre::eyre::eyre!("not a valid direction: {s:?}")),
        }
    }
}

#[derive(Debug)]
struct Movement {
    direction: Direction,
    distance: u64,
}

fn main() -> color_eyre::Result<()> {
    color_eyre::install().unwrap();
    let contents: String = fs::read_to_string("../../inputs/day9.txt").unwrap();
    let lines = contents
        .lines()
        .map(|line| {
            let split = line.split(" ").collect::<Vec<_>>();
            let distance = split[1].parse::<u64>();
            let direction = Direction::try_from(split[0]);
            match (distance, direction) {
                (Ok(dis), Ok(dir)) => Ok(Movement {
                    direction: dir,
                    distance: dis,
                }),
                _ => Err(()),
            }
            .unwrap()
        })
        .collect::<Vec<_>>();

    dbg!(lines);
    Ok(())
}
