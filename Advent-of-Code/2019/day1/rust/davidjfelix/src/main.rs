use std::fs::File;
use std::io::{BufReader, BufRead};

fn main() {
    let file = File::open("./input.txt").expect("File could not be opened.");
    let reader = BufReader::new(file);

    let total_fuel_required: u64 = reader
        .lines()
        .map(|line| line.unwrap())
        .map(|line| line.parse::<u64>())
        .map(|mass| mass.unwrap())
        .map(|mass| get_fuel_required(mass))
        .sum();
    println!("{}", total_fuel_required);
}

fn calc_fuel_for_mass(mass: u64) -> u64 {
    let fuel_required = mass / 3;
    if fuel_required >= 2 {
        fuel_required - 2
    } else {
        0
    }
}

fn get_fuel_required(mass: u64) -> u64 {
    let mut fuel_needed: u64 = 0;
    let mut mass_to_check = mass;
    loop {
        let fuel = calc_fuel_for_mass(mass_to_check);
        if fuel == 0 {
            break;
        } else {
            fuel_needed += fuel;
        }
        mass_to_check = fuel;
    }
    fuel_needed
}

#[test]
fn test_calc_fuel_for_mass() {
    // Specified test cases
    assert_eq!(calc_fuel_for_mass(12), 2);
    assert_eq!(calc_fuel_for_mass(14), 2);
    assert_eq!(calc_fuel_for_mass(1969), 654);
    assert_eq!(calc_fuel_for_mass(100756), 33583);
}

#[test]
fn test_get_fuel_required() {
    // Specified test cases
    assert_eq!(get_fuel_required(14), 2);
    assert_eq!(get_fuel_required(1969), 966);
    assert_eq!(get_fuel_required(100756), 50346);
}
