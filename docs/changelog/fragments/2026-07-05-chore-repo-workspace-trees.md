### chore(repo): isolate nested workspace trees

Moved the Daily UI, Joy of React, and Advent of Code code into `workspaces/` so workspace roots can
stay contained away from the parent repo. The moved trees were renamed to kebab-case, including
local React component files, generated artifacts were left out of the new locations, and the root
Cargo workspace now reserves `crates/*` for first-party Rust crates while continuing to include the
Advent of Code 2022 Rust crates.
