use itertools::Itertools;
use std::fs;

fn main() {
    let contents: String = fs::read_to_string("../../inputs/day3.txt").unwrap();
    let input: Vec<String> = contents.lines().map(|line| line.to_owned()).collect();

    let p1: usize = input
        .iter()
        .map(|line| {
            let half_len = line.len() / 2;
            let ruck = vec![line[..half_len].to_string(), line[half_len..].to_string()];
            for ch in ruck[0].chars() {
                if ruck[1].contains(ch) {
                    // LMAO JANK
                    return "0abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
                        .chars()
                        .position(|letter| ch == letter)
                        .unwrap_or_default();
                }
            }
            return 0;
        })
        .sum();

    print!("{:?}\n", p1);

    let p2: usize = input
        .iter()
        .chunks(3)
        .into_iter()
        .map(|chunk| {
            let group: Vec<&String> = chunk.collect();
            for ch in group[0].chars() {
                if group[1].contains(ch) && group[2].contains(ch) {
                    // LMAO JANK
                    return "0abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
                        .chars()
                        .position(|letter| ch == letter)
                        .unwrap_or_default();
                }
            }
            return 0;
        })
        .sum();

    print!("{:?}\n", p2);
}
