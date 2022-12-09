use std::fs;

fn main() -> color_eyre::Result<()> {
    color_eyre::install().unwrap();

    let contents: String = fs::read_to_string("../../inputs/day8.txt").unwrap();
    let input = contents
        .lines()
        .map(|l| {
            l.chars()
                .map(|digit| digit.to_digit(10).expect("parses"))
                .collect::<Vec<_>>()
        })
        .collect::<Vec<_>>();

    // p1
    let row_len = input.len();
    let row_max = row_len - 1;
    let col_len = input[0].len();
    let col_max = col_len - 1;

    let mut p1_matrix: Vec<Vec<usize>> = Vec::new();
    for row in 0..row_len {
        p1_matrix.push(Vec::new());
        'col: for col in 0..col_len {
            // Set edges to visible
            if row == 0 || col == 0 || row == row_max || col == col_max {
                p1_matrix[row].push(1);
                continue 'col;
            }

            p1_matrix[row].push(0);
        }
    }

    for row in 0..row_len {
        for col in 0..col_len {
            // Is it visible to the left?
            let left_max = input[row]
                .iter()
                .take(col)
                .map(|tree| tree.to_owned())
                .max()
                .unwrap_or_default();
            if left_max < input[row][col] && input[row][col] != 0 {
                p1_matrix[row][col] = 1;
                continue;
            }

            // Is it visible to the right?
            let right_max = input[row]
                .iter()
                .rev()
                .take(col_max - col)
                .map(|tree| tree.to_owned())
                .max()
                .unwrap_or_default();
            if right_max < input[row][col] && input[row][col] != 0 {
                p1_matrix[row][col] = 1;
                continue;
            }

            // Is it visible to the top?
            let top_max = input
                .iter()
                .take(row)
                .map(|tree_col| tree_col[col].to_owned())
                .max()
                .unwrap_or_default();
            if top_max < input[row][col] && input[row][col] != 0 {
                p1_matrix[row][col] = 1;
                continue;
            }

            // Is it visible to the bottom?
            let bottom_max = input
                .iter()
                .rev()
                .take(row_max - row)
                .map(|tree_col| tree_col[col].to_owned())
                .max()
                .unwrap_or_default();
            if bottom_max < input[row][col] && input[row][col] != 0 {
                p1_matrix[row][col] = 1;
                continue;
            }
        }
    }

    let p1: usize = p1_matrix.iter().map(|row| row.iter().sum::<usize>()).sum();
    dbg!(p1);

    // p2

    let mut p2_matrix: Vec<Vec<usize>> = Vec::new();
    for row in 0..row_len {
        p2_matrix.push(Vec::new());
        for _col in 0..col_len {
            p2_matrix[row].push(0);
        }
    }

    for row in 0..row_len {
        for col in 0..col_len {
            let left_scene = input[row]
                .iter()
                .take(col)
                .map(|tree| tree.to_owned())
                .rev()
                .collect::<Vec<_>>();
            let mut left_scenic_score = 0;
            for tree in left_scene {
                left_scenic_score += 1;

                if tree >= input[row][col] {
                    break;
                }
            }

            let right_scene = input[row]
                .iter()
                .rev()
                .take(col_max - col)
                .map(|tree| tree.to_owned())
                .rev()
                .collect::<Vec<_>>();
            let mut right_scenic_score = 0;
            for tree in right_scene {
                right_scenic_score += 1;

                if tree >= input[row][col] {
                    break;
                }
            }

            let top_scene = input
                .iter()
                .take(row)
                .map(|tree_col| tree_col[col].to_owned())
                .rev()
                .collect::<Vec<_>>();
            let mut top_scenic_score = 0;
            for tree in top_scene {
                top_scenic_score += 1;

                if tree >= input[row][col] {
                    break;
                }
            }

            let bottom_scene = input
                .iter()
                .rev()
                .take(row_max - row)
                .map(|tree_col| tree_col[col].to_owned())
                .rev()
                .collect::<Vec<_>>();
            let mut bottom_scenic_score = 0;
            for tree in bottom_scene {
                bottom_scenic_score += 1;

                if tree >= input[row][col] {
                    break;
                }
            }

            p2_matrix[row][col] =
                left_scenic_score * right_scenic_score * top_scenic_score * bottom_scenic_score;
        }
    }

    let p2 = p2_matrix
        .iter()
        .map(|row| {
            row.iter()
                .map(|tree| tree.to_owned())
                .max()
                .unwrap_or_default()
        })
        .max()
        .unwrap_or_default();
    dbg!(p2);
    Ok(())
}
