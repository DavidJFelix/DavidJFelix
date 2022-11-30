#[derive(Debug)]
pub enum CalculatorInput {
    Add,
    Subtract,
    Multiply,
    Divide,
    Value(i32),
}

pub fn evaluate(inputs: &[CalculatorInput]) -> Option<i32> {
    let mut input_stack: Vec<i32> = vec![];
    for input in inputs.iter() {
        match input {
            CalculatorInput::Value(n) => input_stack.push(*n),
            op => {
                if input_stack.len() < 2 {
                    return None;
                }

                let right = input_stack.pop().unwrap();
                let left = input_stack.pop().unwrap();
                match op {
                    CalculatorInput::Add => input_stack.push(left + right),
                    CalculatorInput::Subtract => input_stack.push(left - right),
                    CalculatorInput::Multiply => input_stack.push(left * right),
                    CalculatorInput::Divide => input_stack.push(left / right),
                    _ => return None,
                }
            }
        }
    }
    match input_stack.len() {
        1 => input_stack.pop(),
        _ => None,
    }
}
