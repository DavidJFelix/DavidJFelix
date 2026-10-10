### chore(tooling): move bun to 1.4.3 in one place

Bun moves from 1.4.2 to 1.4.3 at every pin: the mise tool and its lockfile, the `packageManager`
fields in the repo-root and web-apps `package.json`, and the bun constraint on the Renovate catalog
rule. Renovate opened a separate PR for each manager that saw a pin, so a new `bun runtime` group
rule now puts every patch and minor bun update into one PR. `@types/bun` stays in the weekly bun
batch because it publishes on its own schedule (no 1.4.3 exists yet).
