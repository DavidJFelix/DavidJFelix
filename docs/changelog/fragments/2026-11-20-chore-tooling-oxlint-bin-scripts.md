### chore(tooling): lint the repo-root bin/ scripts with oxlint

Before, oxlint did not check the scripts in `bin/`. The new `bin/.oxlintrc.jsonc` extends the shared
web-apps config, so the scripts get the same rules, `curly` included. `mise run lint:bin` runs it,
and a new `oxlint (bin/)` job in CI repo runs that task. Type-aware rules stay off for `bin/`,
because it has no `tsconfig.json`. 51 braceless bodies in `bin/` got braces; no behavior changed.
