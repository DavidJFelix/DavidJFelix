use std::convert::From;
use std::{fs, str::FromStr};

type Score = u64;

#[derive(Clone, Copy, Debug, PartialEq)]
enum Play {
    Rock,
    Paper,
    Scissors,
}

impl Play {
    pub fn from_opponent_play(opp_play: Play, outcome: Outcome) -> Self {
        match (opp_play, outcome) {
            (Play::Rock, Outcome::Draw)
            | (Play::Paper, Outcome::Loss)
            | (Play::Scissors, Outcome::Win) => Play::Rock,
            (Play::Rock, Outcome::Win)
            | (Play::Paper, Outcome::Draw)
            | (Play::Scissors, Outcome::Loss) => Play::Paper,
            (Play::Rock, Outcome::Loss)
            | (Play::Paper, Outcome::Win)
            | (Play::Scissors, Outcome::Draw) => Play::Scissors,
        }
    }
}

impl From<Play> for Score {
    fn from(r: Play) -> Self {
        match r {
            Play::Rock => 1,
            Play::Paper => 2,
            Play::Scissors => 3,
        }
    }
}

impl FromStr for Play {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "A" | "X" => Ok(Play::Rock),
            "B" | "Y" => Ok(Play::Paper),
            "C" | "Z" => Ok(Play::Scissors),
            _ => Err(()),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum Outcome {
    Win,
    Loss,
    Draw,
}

impl Outcome {
    pub fn outcome(opp_play: Play, my_play: Play) -> Self {
        match (opp_play, my_play) {
            (Play::Rock, Play::Paper)
            | (Play::Paper, Play::Scissors)
            | (Play::Scissors, Play::Rock) => Outcome::Win,
            (Play::Rock, Play::Rock)
            | (Play::Paper, Play::Paper)
            | (Play::Scissors, Play::Scissors) => Outcome::Draw,
            (Play::Rock, Play::Scissors)
            | (Play::Paper, Play::Rock)
            | (Play::Scissors, Play::Paper) => Outcome::Loss,
        }
    }
}

impl FromStr for Outcome {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "X" => Ok(Outcome::Loss),
            "Y" => Ok(Outcome::Draw),
            "Z" => Ok(Outcome::Win),
            _ => Err(()),
        }
    }
}

impl From<Outcome> for Score {
    fn from(r: Outcome) -> Self {
        match r {
            Outcome::Loss => 0,
            Outcome::Draw => 3,
            Outcome::Win => 6,
        }
    }
}

fn main() {
    let contents: String = fs::read_to_string("../../inputs/day2.txt").unwrap();
    let input: Vec<Vec<&str>> = contents
        .lines()
        .map(|line| line.split(" ").collect())
        .collect();

    let p1_score: u64 = input
        .iter()
        .map(|line| {
            line.iter()
                .map(|play| Play::from_str(play).unwrap())
                .collect()
        })
        .map(|game: Vec<Play>| {
            Score::from(Outcome::outcome(game[0], game[1])) + Score::from(game[1])
        })
        .sum();

    print!("{:?}\n", p1_score);

    let p2_score: u64 = input
        .iter()
        .map(|line| {
            let opp_play = Play::from_str(line[0]).unwrap();
            let outcome = Outcome::from_str(line[1]).unwrap();
            let my_play = Play::from_opponent_play(opp_play, outcome);
            Score::from(my_play) + Score::from(outcome)
        })
        .sum();

    print!("{:?}\n", p2_score);
}
