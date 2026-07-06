use itertools::Itertools;
use std::{
    collections::{HashMap, VecDeque},
    fs,
};

fn main() {
    let contents: String = fs::read_to_string("../../inputs/day5.txt").unwrap();
    let input: Vec<String> = contents.split("\n\n").map(|it| it.to_owned()).collect();

    // Stack Map parsing
    let stack_map: Vec<Vec<String>> = input[0]
        .lines()
        // We're gonna reverse it because it's easier to work with n-length stacks 0-first
        .rev()
        .map(|line| {
            line.chars()
                .chunks(4)
                .into_iter()
                .map(|chunk| {
                    chunk
                        .map(|ch| ch.to_string().to_owned())
                        .collect::<Vec<String>>()[1]
                        .clone()
                })
                .collect_vec()
        })
        .collect();

    // Instruction parsing
    let instructions: Vec<Vec<usize>> = input[1]
        .lines()
        .map(|line| {
            line.split(' ')
                .map(|it| it.to_owned().parse::<usize>().unwrap_or_default())
                .filter(|it| *it > 0)
                .collect()
        })
        .collect();

    // p1
    let mut p1_stack: HashMap<usize, VecDeque<String>> = HashMap::new();

    // Build a stack
    for stack_addr in stack_map[0].clone() {
        let addr = stack_addr.to_string().parse::<usize>().unwrap_or_default();
        p1_stack.insert(addr, VecDeque::new());
    }

    for row in stack_map[1..].iter() {
        let mut col_pos: usize = 1;
        while col_pos < row.len() + 1 {
            let deq: &mut VecDeque<String> = p1_stack.get_mut(&col_pos).unwrap();
            if row[col_pos - 1] != " " {
                deq.push_back(row[col_pos - 1].clone());
            }
            col_pos += 1;
        }
    }

    // parse instructions
    for instruction in instructions.iter() {
        let mut count = 0;
        while count < instruction[0] {
            let from_stack = p1_stack.get_mut(&instruction[1]).unwrap();
            let value = from_stack.pop_back().unwrap();
            let to_stack = p1_stack.get_mut(&instruction[2]).unwrap();
            to_stack.push_back(value);
            count += 1;
        }
    }

    // Read the stack
    for stack_addr in stack_map[0].clone() {
        let addr = stack_addr.to_string().parse::<usize>().unwrap_or_default();
        let top = p1_stack.get_mut(&addr).unwrap().pop_back().unwrap();
        print!("{}", top)
    }
    print!("\n");

    // p2
    let mut p2_stack: HashMap<usize, VecDeque<String>> = HashMap::new();

    // Build a stack
    for stack_addr in stack_map[0].clone() {
        let addr = stack_addr.to_string().parse::<usize>().unwrap_or_default();
        p2_stack.insert(addr, VecDeque::new());
    }

    for row in stack_map[1..].iter() {
        let mut col_pos: usize = 1;
        while col_pos < row.len() + 1 {
            let deq: &mut VecDeque<String> = p2_stack.get_mut(&col_pos).unwrap();
            if row[col_pos - 1] != " " {
                deq.push_back(row[col_pos - 1].clone());
            }
            col_pos += 1;
        }
    }

    // parse instructions
    for instruction in instructions.iter() {
        let mut count = 0;
        let mut instruction_buffer: VecDeque<String> = VecDeque::new();
        while count < instruction[0] {
            let from_stack = p2_stack.get_mut(&instruction[1]).unwrap();
            let value = from_stack.pop_back().unwrap();
            instruction_buffer.push_front(value);
            count += 1;
        }

        count = 0;
        while count < instruction[0] {
            let value = instruction_buffer.pop_front().unwrap();
            let to_stack = p2_stack.get_mut(&instruction[2]).unwrap();
            to_stack.push_back(value);
            count += 1;
        }
    }

    // Read the stack
    for stack_addr in stack_map[0].clone() {
        let addr = stack_addr.to_string().parse::<usize>().unwrap_or_default();
        let top = p2_stack.get_mut(&addr).unwrap().pop_back().unwrap();
        print!("{}", top)
    }
    print!("\n")
}
