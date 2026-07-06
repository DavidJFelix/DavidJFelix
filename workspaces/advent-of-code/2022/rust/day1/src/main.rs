use itertools::Itertools;
use std::fs;

fn main() {
    let contents: String = fs::read_to_string("../../inputs/day1.txt").unwrap();
    let input = contents
        .split("\n\n")
        // Remove the trailing newline group from the end
        .filter(|group| *group != "")
        .map(|group| {
            group
                .split("\n")
                .map(|line| line.parse::<u64>().unwrap_or_default())
        });

    let p1_max_calories: u64 = input
        .to_owned()
        .map(|calories| calories.sum())
        .max()
        .unwrap_or_default();

    print!("{:?}\n", p1_max_calories);

    let p2_top_3_calories_sum: u64 = input
        .to_owned()
        .map(|calories| calories.sum::<u64>())
        .sorted()
        .rev()
        .take(3)
        .sum();

    print!("{:?}\n", p2_top_3_calories_sum);
}
