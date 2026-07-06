use itertools::Itertools;
use std::{collections::VecDeque, fs};

fn main() {
    let contents: String = fs::read_to_string("../../inputs/day6.txt").unwrap();
    let input: Vec<char> = contents.chars().collect();

    // p1
    let mut last4: VecDeque<char> = VecDeque::new();
    last4.push_back(input[0].clone());
    last4.push_back(input[1].clone());
    last4.push_back(input[2].clone());
    last4.push_back(input[3].clone());

    let mut p1 = 4;
    while last4
        .clone()
        .into_iter()
        .unique()
        .collect::<Vec<char>>()
        .len()
        != 4
        && p1 < input.len()
    {
        last4.pop_front();
        last4.push_back(input[p1].clone());
        p1 += 1;
    }

    print!("{:?}\n", p1);

    // p2
    let mut last14: VecDeque<char> = VecDeque::new();
    for i in 0..14 {
        last14.push_back(input[i].clone());
    }

    let mut p2 = 14;
    while last14
        .clone()
        .into_iter()
        .unique()
        .collect::<Vec<char>>()
        .len()
        != 14
        && p2 < input.len()
    {
        last14.pop_front();
        last14.push_back(input[p2].clone());
        p2 += 1;
    }

    print!("{:?}\n", p2)
}
