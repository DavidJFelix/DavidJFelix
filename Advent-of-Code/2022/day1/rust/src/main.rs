use itertools::Itertools;
use std::fs;

fn main() {
    let contents: String = fs::read_to_string("../input.txt").unwrap();
    let input: Vec<Vec<u64>> = contents
        .lines()
        .map(|line| line.parse::<u64>())
        .group_by(|result| result.is_ok())
        .into_iter()
        .filter(|(is_ok, _)| *is_ok)
        .map(|(_, lines)| lines.map(|line| line.unwrap()).collect())
        .collect();

    let p1_max_calories: u64 = input
        .iter()
        .map(|calories| calories.iter().sum())
        .max()
        .unwrap();
    print!("{:?}\n", p1_max_calories);

    let p2_top_3_calories_sum: u64 = input
        .iter()
        .map(|calories| calories.iter().sum::<u64>())
        .sorted()
        .rev()
        .take(3)
        .sum();

    print!("{:?}\n", p2_top_3_calories_sum);
}