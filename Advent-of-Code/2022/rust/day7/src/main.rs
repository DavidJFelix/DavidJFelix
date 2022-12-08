use camino::Utf8PathBuf;
use id_tree::{InsertBehavior, Node, Tree};
use nom::{
    branch::alt,
    bytes::complete::{tag, take_while1},
    combinator::{all_consuming, map},
    sequence::{preceded, separated_pair},
    Finish, IResult,
};
use std::fs;

fn parse_path(i: &str) -> IResult<&str, Utf8PathBuf> {
    map(
        take_while1(|c: char| "abcdefghijklmnopqrstuvwxyz./".contains(c)),
        Into::into,
    )(i)
}

#[derive(Debug)]
struct Ls;

fn parse_ls(i: &str) -> IResult<&str, Ls> {
    map(tag("ls"), |_| Ls)(i)
}

#[derive(Debug)]
struct Cd(Utf8PathBuf);

fn parse_cd(i: &str) -> IResult<&str, Cd> {
    map(preceded(tag("cd "), parse_path), Cd)(i)
}

#[derive(Debug)]
enum Command {
    Ls,
    Cd(Utf8PathBuf),
}

impl From<Ls> for Command {
    fn from(_ls: Ls) -> Self {
        Command::Ls
    }
}

impl From<Cd> for Command {
    fn from(cd: Cd) -> Self {
        Command::Cd(cd.0)
    }
}

fn parse_command(i: &str) -> IResult<&str, Command> {
    let (i, _) = tag("$ ")(i)?;
    alt((map(parse_ls, Into::into), map(parse_cd, Into::into)))(i)
}

#[derive(Debug)]
enum Output {
    Dir(Utf8PathBuf),
    File(u64, Utf8PathBuf),
}

fn parse_output(i: &str) -> IResult<&str, Output> {
    let parse_file = map(
        separated_pair(nom::character::complete::u64, tag(" "), parse_path),
        |(size, path)| Output::File(size, path),
    );
    let parse_dir = map(preceded(tag("dir "), parse_path), Output::Dir);

    alt((parse_file, parse_dir))(i)
}

#[derive(Debug)]
enum Line {
    Command(Command),
    Output(Output),
}

fn parse_line(i: &str) -> IResult<&str, Line> {
    alt((
        map(parse_command, Line::Command),
        map(parse_output, Line::Output),
    ))(i)
}

#[derive(Debug)]
struct FileNode {
    path: Utf8PathBuf,
    size: u64,
}

fn total_size(tree: &Tree<FileNode>, node: &Node<FileNode>) -> color_eyre::Result<u64> {
    let mut total = node.data().size;
    for child in node.children() {
        total += total_size(tree, tree.get(child)?)?;
    }
    Ok(total)
}

fn main() -> color_eyre::Result<()> {
    color_eyre::install().unwrap();

    let contents: String = fs::read_to_string("../../inputs/day7.txt").unwrap();
    let lines = contents
        .lines()
        .map(|l| all_consuming(parse_line)(l).finish().unwrap().1);

    let mut tree = Tree::<FileNode>::new();
    let root = tree.insert(
        Node::new(FileNode {
            path: "/".into(),
            size: 0,
        }),
        InsertBehavior::AsRoot,
    )?;

    let mut curr = root;

    for line in lines {
        // println!("{line:?}");
        match line {
            Line::Command(cmd) => match cmd {
                Command::Ls => {}
                Command::Cd(path) => match path.as_str() {
                    "/" => {}
                    ".." => {
                        curr = tree.get(&curr)?.parent().unwrap().clone();
                    }
                    _ => {
                        let node = Node::new(FileNode {
                            path: path.clone(),
                            size: 0,
                        });
                        curr = tree.insert(node, InsertBehavior::UnderNode(&curr))?;
                    }
                },
            },
            Line::Output(entry) => match entry {
                Output::Dir(_) => {}
                Output::File(size, path) => {
                    let node = Node::new(FileNode { size, path });
                    tree.insert(node, InsertBehavior::UnderNode(&curr))?;
                }
            },
        }
    }

    // let mut s = String::new();
    // tree.write_formatted(&mut s)?;
    // println!("{s}");

    // Part1
    let sum = tree
        .traverse_pre_order(tree.root_node_id().unwrap())?
        .filter(|n| !n.children().is_empty())
        .map(|n| total_size(&tree, n).unwrap())
        .filter(|&s| s <= 100_000)
        .sum::<u64>();
    dbg!(sum);

    // part 2
    let total_space = 70000000_u64;
    let used_space = total_size(&tree, tree.get(tree.root_node_id().unwrap()).unwrap()).unwrap();
    let free_space = total_space.checked_sub(dbg!(used_space)).unwrap();
    let needed_free_space = 30000000_u64;
    let minimum_space_to_free = needed_free_space.checked_sub(free_space).unwrap();

    let removed_dir_size = tree
        .traverse_pre_order(tree.root_node_id().unwrap())?
        .map(|n| total_size(&tree, n).unwrap())
        .filter(|&s| s >= minimum_space_to_free)
        .min();
    dbg!(removed_dir_size);

    Ok(())
}
