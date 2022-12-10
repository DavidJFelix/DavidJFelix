use itertools::Itertools;
use std::fs;

#[derive(Debug, Clone, Copy, PartialEq)]
enum Instruction {
    Noop,
    AddProcessing,
    Add(i64),
}

#[derive(Debug, Clone, Copy, PartialEq)]
struct State {
    start_cycle: i64,
    x: i64,
}

fn main() -> color_eyre::Result<()> {
    color_eyre::install().unwrap();
    let contents: String = fs::read_to_string("../../inputs/day10.txt").unwrap();
    let mut cycle = 1;
    let mut x = 1_i64;
    let input = contents
        .lines()
        .map(|line| {
            let components = line.split(" ").collect::<Vec<_>>();
            // Naive and dangerous like me
            match components.len() {
                2 => vec![
                    Instruction::AddProcessing,
                    Instruction::Add(components[1].parse::<i64>().unwrap_or_default()),
                ],
                _ => vec![Instruction::Noop],
            }
        })
        .flatten()
        .map(|instruction| match instruction {
            Instruction::Noop | Instruction::AddProcessing => {
                let state = State {
                    start_cycle: cycle,
                    x: x,
                };
                cycle += 1;
                state
            }
            Instruction::Add(i) => {
                let state = State {
                    start_cycle: cycle,
                    x: x,
                };
                cycle += 1;
                x += i;
                state
            }
        })
        .collect::<Vec<_>>();

    // p1 - 13180
    let p1_sum = input
        .iter()
        .filter(|state| [20, 60, 100, 140, 180, 220].contains(&state.start_cycle))
        .map(|state| state.x * state.start_cycle)
        .sum::<i64>();

    dbg!(p1_sum);

    // p2
    let mut screen: Vec<char> = Vec::new();
    for cycle in 0..240_usize {
        let line_cycle = cycle as i64 % 40;
        let state = input[cycle];
        let sprite: [i64; 3] = [state.x - 1, state.x, state.x + 1]; // i had to modify from -2, -1, 0
        if sprite.contains(&line_cycle) {
            screen.push('#')
        } else {
            screen.push('.')
        }
    }

    screen
        .iter()
        .chunks(40)
        .into_iter()
        .map(|line| line.collect::<String>())
        .for_each(|line| println!("{line}"));
    Ok(())
}
