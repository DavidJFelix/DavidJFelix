use itertools::Itertools;
use std::fs;

fn main() {
    let contents: String = fs::read_to_string("../input.txt").unwrap();
    let input: Vec<Vec<u64>> = contents
        .split("\n\n")
        // Remove the trailing newline group from the end
        .filter(|group| *group != "")
        .map(|group| {
            group
                .split("\n")
                .map(|line| line.parse::<u64>().unwrap_or_default())
                .collect()
        })
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
