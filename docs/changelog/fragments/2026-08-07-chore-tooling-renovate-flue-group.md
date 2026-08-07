### chore(tooling): group the @flue packages in renovate updates

The four `@flue` packages (`sdk`, `react`, `runtime`, `cli`) release as a matched set at a single
version -- onvibes.org holds all of them at `1.0.0-beta.9` -- so letting Renovate split them across
the patch/minor batch and individual major PRs risks landing a mixed set. A new package rule groups
every `@flue/**` update type into one PR that moves the whole set together, mirroring the existing
wrangler/vite-plugin pairing rule.
