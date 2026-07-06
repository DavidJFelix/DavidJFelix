use std::fs;

fn main() {
    let contents: String = fs::read_to_string("../../inputs/day4.txt").unwrap();
    let input: Vec<Vec<Vec<usize>>> = contents
        .lines()
        .map(|line| line.to_owned())
        .filter(|group| *group != "")
        .map(|line| {
            line.split(',')
                .map(|coord| {
                    coord
                        .split('-')
                        .map(|section| section.parse::<usize>().unwrap_or_default())
                        .collect::<Vec<usize>>()
                })
                .collect::<Vec<Vec<usize>>>()
        })
        .collect();

    let p1: usize = input
        .iter()
        .filter(|sections| {
            (sections[0][0] <= sections[1][0] && sections[0][1] >= sections[1][1])
                || (sections[1][0] <= sections[0][0] && sections[1][1] >= sections[0][1])
        })
        .count();

    print!("{:?}\n", p1);

    let p2: usize = input
        .iter()
        .filter(|sections| {
            // This feels like it could be simpler but im dumb before second coffee
            !((sections[0][0] < sections[1][0] && sections[0][1] < sections[1][0])
                || (sections[0][0] > sections[1][1] && sections[0][1] > sections[1][1]))
        })
        .count();

    print!("{:?}\n", p2);
}
