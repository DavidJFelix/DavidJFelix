### chore(tooling): batch bun and catalog patch/minor updates in Renovate

Renovate's bun manager supersedes npm for every package.json at or below a `bun.lock`, so the repo
root and the whole web-apps workspace were never in the `npm patch/minor` group: each ungrouped
patch/minor bump (lucide-react, msw, @atproto/api, ...) opened its own PR, and the npm group carried
only the pnpm exercise trees. A new `bun patch/minor` rule now batches the `bun` and
`custom.jsonata` (web-apps catalog) managers into one weekly PR. The rule is separate from the npm
group, so a web-app breakage does not hold back the exercise bumps. The rule sits above the named
groups, so cloudflare, tanstack, oxc, sentry, and the others still get their own PRs.
