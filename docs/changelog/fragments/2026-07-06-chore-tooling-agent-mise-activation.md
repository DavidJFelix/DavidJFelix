### chore(tooling): activate mise for agent shells

Configured Claude Code and Pi project shells to source the repo's mise activation script before
running commands, so agent commands resolve the repo-pinned toolchain without `mise exec` prefixes.
