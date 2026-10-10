### chore(tooling): move every bun pin together

The `packageManager` fields in the repo-root and web-apps `package.json` move to `bun@1.4.3`, to
match the mise tool and the Renovate catalog constraint. Renovate reads those two fields from npm,
which `config:best-practices` holds for 3 days, while the mise tool and the constraint read GitHub
releases with no hold. So each bun release arrived as several PRs, and the `packageManager` pins
came last or not at all. A new `bun runtime` group rule now puts every patch and minor bun update
into one PR and holds the whole group for the same 3 days. `@types/bun` stays in the weekly bun
batch because it publishes on its own schedule.
