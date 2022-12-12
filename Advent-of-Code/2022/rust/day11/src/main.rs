#[macro_use]
extern crate maplit;

use std::{collections::HashMap, fmt::Error, num::ParseIntError};

use nom::{
    branch::alt,
    bytes::complete::{tag, tag_no_case},
    character::complete::{digit1, line_ending, multispace1, space1},
    combinator::map_res,
    multi::separated_list0,
    sequence::tuple,
    IResult,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
struct Monkey(u64);

fn parse_monkey(input: &str) -> IResult<&str, Monkey> {
    let monkey = tag_no_case("monkey");
    let space = tag(" ");
    let number = map_res(digit1, |res: &str| res.parse::<u64>());

    let (input, (_, _, number)) = tuple((monkey, space, number))(input)?;

    Ok((input, Monkey(number)))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
struct ItemWorryLevel(u64);

fn parse_starting_items(input: &str) -> IResult<&str, Vec<ItemWorryLevel>> {
    let starting_items = tag("Starting items: ");
    let comma = tag(", ");
    let item = map_res(
        digit1,
        |res: &str| -> Result<ItemWorryLevel, ParseIntError> {
            let number = res.parse::<u64>()?;
            Ok(ItemWorryLevel(number))
        },
    );
    let items = separated_list0(comma, item);

    let (input, (_, items)) = tuple((starting_items, items))(input)?;
    Ok((input, items))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
enum Operand {
    Old,
    Value(u64),
}

fn parse_operand(input: &str) -> IResult<&str, Operand> {
    let old = map_res(tag("old"), |_| -> Result<Operand, Error> {
        Ok(Operand::Old)
    });
    let value = map_res(digit1, |res: &str| -> Result<Operand, ParseIntError> {
        let number = res.parse::<u64>()?;
        Ok(Operand::Value(number))
    });

    alt((old, value))(input)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
enum Operation {
    Add,
    Multiply,
}

fn parse_operation(input: &str) -> IResult<&str, Operation> {
    let multiply = map_res(tag("*"), |_| -> Result<Operation, Error> {
        Ok(Operation::Multiply)
    });
    let add = map_res(tag("+"), |_| -> Result<Operation, Error> {
        Ok(Operation::Add)
    });

    alt((multiply, add))(input)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
struct WorryLevelResponseEquation {
    left: Operand,
    operation: Operation,
    right: Operand,
}

fn parse_worry_level_response_equation(input: &str) -> IResult<&str, WorryLevelResponseEquation> {
    let operation_intro = tag("Operation: new =");

    let (input, (_, _, left, _, operation, _, right)) = tuple((
        operation_intro,
        space1,
        parse_operand,
        space1,
        parse_operation,
        space1,
        parse_operand,
    ))(input)?;

    Ok((
        input,
        WorryLevelResponseEquation {
            left,
            operation,
            right,
        },
    ))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
struct ConditionalMonkeyResponse {
    divisible_by: u64,
    true_monkey_receiver: Monkey,
    false_monkey_receiver: Monkey,
}

fn parse_conditional_monkey_response(input: &str) -> IResult<&str, ConditionalMonkeyResponse> {
    let conditional_intro = tag("Test: divisible by");
    let true_intro = tag("If true: throw to");
    let false_intro = tag("If false: throw to");
    let divisor = map_res(digit1, |res: &str| res.parse::<u64>());
    let (
        input,
        (_, _, divisible_by, _, _, _, true_monkey_receiver, _, _, _, false_monkey_receiver),
    ) = tuple((
        conditional_intro,
        space1,
        divisor,
        multispace1,
        true_intro,
        space1,
        parse_monkey,
        multispace1,
        false_intro,
        space1,
        parse_monkey,
    ))(input)?;
    Ok((
        input,
        ConditionalMonkeyResponse {
            divisible_by,
            true_monkey_receiver,
            false_monkey_receiver,
        },
    ))
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
struct MonkeyState {
    items: Vec<ItemWorryLevel>,
    equation: WorryLevelResponseEquation,
    conditional: ConditionalMonkeyResponse,
}

fn parse_monkey_state(input: &str) -> IResult<&str, MonkeyState> {
    let (input, (items, _, equation, _, conditional)) = tuple((
        parse_starting_items,
        multispace1,
        parse_worry_level_response_equation,
        multispace1,
        parse_conditional_monkey_response,
    ))(input)?;
    Ok((
        input,
        MonkeyState {
            items,
            equation,
            conditional,
        },
    ))
}

fn parse_monkey_rule_hashmap(input: &str) -> IResult<&str, HashMap<Monkey, MonkeyState>> {
    let colon = tag(":");
    let (input, (entries, _)) = tuple((
        separated_list0(
            multispace1,
            map_res(
                tuple((parse_monkey, colon, multispace1, parse_monkey_state)),
                |(monkey, _, _, monkey_state)| -> Result<(Monkey, MonkeyState), Error> {
                    Ok((monkey, monkey_state))
                },
            ),
        ),
        line_ending,
    ))(input)?;
    let res: HashMap<Monkey, MonkeyState> = entries.into_iter().collect();
    Ok((input, res))
}

fn main() -> color_eyre::Result<()> {
    color_eyre::install().unwrap();
    let contents = include_str!("../../../inputs/day11.txt");
    let hashmap = parse_monkey_rule_hashmap(contents);

    dbg!(hashmap);
    Ok(())
}

#[cfg(test)]
mod test {

    use std::collections::HashMap;

    use test_case::test_case;

    use crate::{
        parse_conditional_monkey_response, parse_monkey, parse_monkey_rule_hashmap,
        parse_monkey_state, parse_operand, parse_operation, parse_starting_items,
        parse_worry_level_response_equation, ConditionalMonkeyResponse, ItemWorryLevel, Monkey,
        MonkeyState, Operand, Operation, WorryLevelResponseEquation,
    };

    #[test_case("Monkey 0", Monkey(0); "uppercase 0")]
    #[test_case("Monkey 1", Monkey(1); "uppercase 1")]
    #[test_case("Monkey 2", Monkey(2); "uppercase 2")]
    #[test_case("Monkey 3", Monkey(3); "uppercase 3")]
    #[test_case("Monkey 4", Monkey(4); "uppercase 4")]
    #[test_case("Monkey 5", Monkey(5); "uppercase 5")]
    #[test_case("Monkey 6", Monkey(6); "uppercase 6")]
    #[test_case("Monkey 7", Monkey(7); "uppercase 7")]
    #[test_case("monkey 0", Monkey(0); "lowercase 0")]
    #[test_case("monkey 1", Monkey(1); "lowercase 1")]
    #[test_case("monkey 2", Monkey(2); "lowercase 2")]
    #[test_case("monkey 3", Monkey(3); "lowercase 3")]
    #[test_case("monkey 4", Monkey(4); "lowercase 4")]
    #[test_case("monkey 5", Monkey(5); "lowercase 5")]
    #[test_case("monkey 6", Monkey(6); "lowercase 6")]
    #[test_case("monkey 7", Monkey(7); "lowercase 7")]
    fn test_parse_monkey(input: &str, expect: Monkey) {
        assert_eq!(parse_monkey(input), Ok(("", expect)))
    }

    #[test_case("Starting items: 79, 98", vec![ItemWorryLevel(79), ItemWorryLevel(98)]; "monkey 0 sample")]
    #[test_case("Starting items: 54, 65, 75, 74", vec![ItemWorryLevel(54), ItemWorryLevel(65), ItemWorryLevel(75), ItemWorryLevel(74)]; "monkey 1 sample")]
    #[test_case("Starting items: 79, 60, 97", vec![ItemWorryLevel(79), ItemWorryLevel(60), ItemWorryLevel(97)]; "monkey 2 sample")]
    #[test_case("Starting items: 74", vec![ItemWorryLevel(74)]; "monkey 3 sample")]
    #[test_case("Starting items: 84, 66, 62, 69, 88, 91, 91", vec![ItemWorryLevel(84), ItemWorryLevel(66), ItemWorryLevel(62), ItemWorryLevel(69), ItemWorryLevel(88), ItemWorryLevel(91), ItemWorryLevel(91)]; "monkey 0 actual")]
    #[test_case("Starting items: 98, 50, 76, 99", vec![ItemWorryLevel(98), ItemWorryLevel(50), ItemWorryLevel(76), ItemWorryLevel(99)]; "monkey 1 actual")]
    #[test_case("Starting items: 72, 56, 94", vec![ItemWorryLevel(72), ItemWorryLevel(56), ItemWorryLevel(94)]; "monkey 2 actual")]
    #[test_case("Starting items: 55, 88, 90, 77, 60, 67", vec![ItemWorryLevel(55), ItemWorryLevel(88), ItemWorryLevel(90), ItemWorryLevel(77), ItemWorryLevel(60), ItemWorryLevel(67)]; "monkey 3 actual")]
    #[test_case("Starting items: 69, 72, 63, 60, 72, 52, 63, 78", vec![ItemWorryLevel(69), ItemWorryLevel(72), ItemWorryLevel(63), ItemWorryLevel(60), ItemWorryLevel(72), ItemWorryLevel(52), ItemWorryLevel(63), ItemWorryLevel(78)]; "monkey 4 actual")]
    #[test_case("Starting items: 89, 73", vec![ItemWorryLevel(89), ItemWorryLevel(73)]; "monkey 5 actual")]
    #[test_case("Starting items: 78, 68, 98, 88, 66", vec![ItemWorryLevel(78), ItemWorryLevel(68), ItemWorryLevel(98), ItemWorryLevel(88), ItemWorryLevel(66)]; "monkey 6 actual")]
    #[test_case("Starting items: 70", vec![ItemWorryLevel(70)]; "monkey 7 actual")]
    fn test_parse_starting_items(input: &str, expect: Vec<ItemWorryLevel>) {
        assert_eq!(parse_starting_items(input), Ok(("", expect)))
    }

    #[test_case("+", Operation::Add)]
    #[test_case("*", Operation::Multiply)]
    fn test_parse_operation(input: &str, expect: Operation) {
        assert_eq!(parse_operation(input), Ok(("", expect)))
    }

    #[test_case("old", Operand::Old)]
    #[test_case("11", Operand::Value(11))]
    #[test_case("1", Operand::Value(1))]
    #[test_case("2", Operand::Value(2))]
    #[test_case("13", Operand::Value(13))]
    #[test_case("5", Operand::Value(5))]
    #[test_case("6", Operand::Value(6))]
    #[test_case("7", Operand::Value(7))]
    #[test_case("19", Operand::Value(19))]
    fn test_parse_operand(input: &str, expect: Operand) {
        assert_eq!(parse_operand(input), Ok(("", expect)))
    }

    #[test_case("Operation: new = old * 19", WorryLevelResponseEquation {left: Operand::Old, operation: Operation::Multiply, right: Operand::Value(19)}; "monkey 0 sample")]
    #[test_case("Operation: new = old + 6", WorryLevelResponseEquation {left: Operand::Old, operation: Operation::Add, right: Operand::Value(6)}; "monkey 1 sample")]
    #[test_case("Operation: new = old * old", WorryLevelResponseEquation {left: Operand::Old, operation: Operation::Multiply, right: Operand::Old}; "monkey 2 sample")]
    #[test_case("Operation: new = old + 3", WorryLevelResponseEquation {left: Operand::Old, operation: Operation::Add, right: Operand::Value(3)}; "monkey 3 sample")]
    #[test_case("Operation: new = old * 11", WorryLevelResponseEquation {left: Operand::Old, operation: Operation::Multiply, right: Operand::Value(11)}; "monkey 0 actual")]
    #[test_case("Operation: new = old * old", WorryLevelResponseEquation {left: Operand::Old, operation: Operation::Multiply, right: Operand::Old}; "monkey 1 actual")]
    #[test_case("Operation: new = old + 1", WorryLevelResponseEquation {left: Operand::Old, operation: Operation::Add, right: Operand::Value(1)}; "monkey 2 actual")]
    #[test_case("Operation: new = old + 2", WorryLevelResponseEquation {left: Operand::Old, operation: Operation::Add, right: Operand::Value(2)}; "monkey 3 actual")]
    #[test_case("Operation: new = old * 13", WorryLevelResponseEquation {left: Operand::Old, operation: Operation::Multiply, right: Operand::Value(13)}; "monkey 4 actual")]
    #[test_case("Operation: new = old + 5", WorryLevelResponseEquation {left: Operand::Old, operation: Operation::Add, right: Operand::Value(5)}; "monkey 5 actual")]
    #[test_case("Operation: new = old + 6", WorryLevelResponseEquation {left: Operand::Old, operation: Operation::Add, right: Operand::Value(6)}; "monkey 6 actual")]
    #[test_case("Operation: new = old + 7", WorryLevelResponseEquation {left: Operand::Old, operation: Operation::Add, right: Operand::Value(7)}; "monkey 7 actual")]
    fn test_parse_worry_level_response_equation(input: &str, expect: WorryLevelResponseEquation) {
        assert_eq!(parse_worry_level_response_equation(input), Ok(("", expect)))
    }

    #[test_case(r#"Test: divisible by 23
    If true: throw to monkey 2
    If false: throw to monkey 3"#,
    ConditionalMonkeyResponse {
        divisible_by: 23,
        true_monkey_receiver: Monkey(2),
        false_monkey_receiver: Monkey(3)
    }; "monkey 0 sample"
    )]
    #[test_case(r#"Test: divisible by 19
    If true: throw to monkey 2
    If false: throw to monkey 0"#,
    ConditionalMonkeyResponse {
        divisible_by: 19,
        true_monkey_receiver: Monkey(2),
        false_monkey_receiver: Monkey(0)
    }; "monkey 1 sample"
    )]
    #[test_case(r#"Test: divisible by 13
    If true: throw to monkey 1
    If false: throw to monkey 3"#,
    ConditionalMonkeyResponse {
        divisible_by: 13,
        true_monkey_receiver: Monkey(1),
        false_monkey_receiver: Monkey(3)
    }; "monkey 2 sample"
    )]
    #[test_case(r#"Test: divisible by 17
    If true: throw to monkey 0
    If false: throw to monkey 1"#,
    ConditionalMonkeyResponse {
        divisible_by: 17,
        true_monkey_receiver: Monkey(0),
        false_monkey_receiver: Monkey(1)
    }; "monkey 3 sample"
    )]
    fn test_parse_conditional_monkey_response(input: &str, expect: ConditionalMonkeyResponse) {
        assert_eq!(parse_conditional_monkey_response(input), Ok(("", expect)))
    }

    #[test_case(r#"Starting items: 79, 98
  Operation: new = old * 19
  Test: divisible by 23
    If true: throw to monkey 2
    If false: throw to monkey 3"#,
    MonkeyState {
        items: vec![ItemWorryLevel(79), ItemWorryLevel(98)],
        equation: WorryLevelResponseEquation {
            left: Operand::Old,
            operation: Operation::Multiply,
            right: Operand::Value(19)
        },
        conditional: ConditionalMonkeyResponse {
            divisible_by: 23,
            true_monkey_receiver: Monkey(2),
            false_monkey_receiver: Monkey(3)
        }
    }; "monkey 0 sample" )]
    #[test_case(r#"Starting items: 54, 65, 75, 74
  Operation: new = old + 6
  Test: divisible by 19
    If true: throw to monkey 2
    If false: throw to monkey 0"#,
    MonkeyState {
        items: vec![ItemWorryLevel(54), ItemWorryLevel(65), ItemWorryLevel(75), ItemWorryLevel(74)],
        equation: WorryLevelResponseEquation {
            left: Operand::Old,
            operation: Operation::Add,
            right: Operand::Value(6)
        },
        conditional: ConditionalMonkeyResponse {
            divisible_by: 19,
            true_monkey_receiver: Monkey(2),
            false_monkey_receiver: Monkey(0)
        }
    }; "monkey 1 sample" )]
    #[test_case(r#"Starting items: 79, 60, 97
  Operation: new = old * old
  Test: divisible by 13
    If true: throw to monkey 1
    If false: throw to monkey 3"#,
    MonkeyState {
        items: vec![ItemWorryLevel(79), ItemWorryLevel(60), ItemWorryLevel(97)],
        equation: WorryLevelResponseEquation {
            left: Operand::Old,
            operation: Operation::Multiply,
            right: Operand::Old
        },
        conditional: ConditionalMonkeyResponse {
            divisible_by: 13,
            true_monkey_receiver: Monkey(1),
            false_monkey_receiver: Monkey(3)
        }
    }; "monkey 2 sample" )]
    #[test_case(r#"Starting items: 74
  Operation: new = old + 3
  Test: divisible by 17
    If true: throw to monkey 0
    If false: throw to monkey 1"#,
    MonkeyState {
        items: vec![ItemWorryLevel(74)],
        equation: WorryLevelResponseEquation {
            left: Operand::Old,
            operation: Operation::Add,
            right: Operand::Value(3)
        },
        conditional: ConditionalMonkeyResponse {
            divisible_by: 17,
            true_monkey_receiver: Monkey(0),
            false_monkey_receiver: Monkey(1)
        }
    }; "monkey 3 sample" )]
    fn test_parse_monkey_state(input: &str, expect: MonkeyState) {
        assert_eq!(parse_monkey_state(input), Ok(("", expect)))
    }

    #[test_case(r#"Monkey 0:
  Starting items: 79, 98
  Operation: new = old * 19
  Test: divisible by 23
    If true: throw to monkey 2
    If false: throw to monkey 3

Monkey 1:
  Starting items: 54, 65, 75, 74
  Operation: new = old + 6
  Test: divisible by 19
    If true: throw to monkey 2
    If false: throw to monkey 0

Monkey 2:
  Starting items: 79, 60, 97
  Operation: new = old * old
  Test: divisible by 13
    If true: throw to monkey 1
    If false: throw to monkey 3

Monkey 3:
  Starting items: 74
  Operation: new = old + 3
  Test: divisible by 17
    If true: throw to monkey 0
    If false: throw to monkey 1
"#, 
    hashmap!{
        Monkey(0) => MonkeyState {
            items: vec![ItemWorryLevel(79), ItemWorryLevel(98)],
            equation: WorryLevelResponseEquation {
                left: Operand::Old,
                operation: Operation::Multiply,
                right: Operand::Value(19)
            },
            conditional: ConditionalMonkeyResponse {
                divisible_by: 23,
                true_monkey_receiver: Monkey(2),
                false_monkey_receiver: Monkey(3)
            }
        },
        Monkey(1) => MonkeyState {
            items: vec![ItemWorryLevel(54), ItemWorryLevel(65), ItemWorryLevel(75), ItemWorryLevel(74)],
            equation: WorryLevelResponseEquation {
                left: Operand::Old,
                operation: Operation::Add,
                right: Operand::Value(6)
            },
            conditional: ConditionalMonkeyResponse {
                divisible_by: 19,
                true_monkey_receiver: Monkey(2),
                false_monkey_receiver: Monkey(0)
            }
        },
        Monkey(2) => MonkeyState {
            items: vec![ItemWorryLevel(79), ItemWorryLevel(60), ItemWorryLevel(97)],
            equation: WorryLevelResponseEquation {
                left: Operand::Old,
                operation: Operation::Multiply,
                right: Operand::Old
            },
            conditional: ConditionalMonkeyResponse {
                divisible_by: 13,
                true_monkey_receiver: Monkey(1),
                false_monkey_receiver: Monkey(3)
            }
        },
        Monkey(3) => MonkeyState {
            items: vec![ItemWorryLevel(74)],
            equation: WorryLevelResponseEquation {
                left: Operand::Old,
                operation: Operation::Add,
                right: Operand::Value(3)
            },
            conditional: ConditionalMonkeyResponse {
                divisible_by: 17,
                true_monkey_receiver: Monkey(0),
                false_monkey_receiver: Monkey(1)
            }
        }
    })]
    fn test_parse_monkey_rule_hashmap(input: &str, expect: HashMap<Monkey, MonkeyState>) {
        assert_eq!(parse_monkey_rule_hashmap(input), Ok(("", expect)))
    }
}
