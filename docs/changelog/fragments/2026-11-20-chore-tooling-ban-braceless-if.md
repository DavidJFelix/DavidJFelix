### chore(tooling): ban braceless control statements with oxlint curly

The shared `workspaces/web-apps/.oxlintrc.jsonc` now sets `curly` to `["error", "all"]`, so every
`if`, `else`, `for`, `while`, and `do` body needs braces, even a one-line `if (x) return`. The rule
covers every web-apps project and the OpenCode harness, which extends the same config.
`oxlint --fix` added braces to the 317 existing braceless bodies, and oxfmt then formatted them. No
behavior changed.
