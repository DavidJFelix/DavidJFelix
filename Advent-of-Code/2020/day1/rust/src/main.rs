use itertools::Itertools;
use std::fs::File;
use std::io::{BufRead, BufReader};

fn main() {
    let file = File::open("./input.txt").expect("File could not be opened.");
    let reader = BufReader::new(file);

    let expenses: Vec<u64> = reader
        .lines()
        .map(|line| line.unwrap())
        .map(|line| line.parse::<u64>())
        .map(|expense| expense.unwrap())
        .collect();

    let pair_product = find_expense_combination(expenses.clone(), 2020, 2)
        .iter()
        .product::<u64>();
    println!("{}", pair_product);
    let trio_product = find_expense_combination(expenses.clone(), 2020, 3)
        .iter()
        .product::<u64>();
    println!("{}", trio_product);
}

fn find_expense_combination(expenses: Vec<u64>, target_sum: u64, count: usize) -> Vec<u64> {
    let combos: Vec<Vec<u64>> = expenses
        .iter()
        .combinations(count)
        .map(|combo| combo.iter().map(|&&it| it.clone()).collect())
        .collect();
    let combo: Vec<u64> = combos
        .iter()
        .find(|combo| combo.iter().sum::<u64>() == target_sum)
        .unwrap()
        .to_vec();
    return combo;
}
