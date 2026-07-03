### feat(tooling): adopt a changelog fragment workflow

Parallel PRs conflicted on every merge because each added its entry to the top of the current
`docs/changelog/YYYY-MM.md`. PRs now add one fragment file each under `docs/changelog/fragments/`
(`YYYY-MM-DD-<type>-<scope>-<short-slug>.md`, body: one entry in the existing format), and the
monthly files are only ever written by the roll-up: `mise run changelog:rollup`
(`bin/changelog-rollup.ts`, bun, unit-tested) folds fragments into the right month -- creating the
month file or day heading as needed, days newest-first, filename order within a day, content
preserved byte-for-byte -- then deletes what it folded and refreshes the README file index. A weekly
`cron-changelog-rollup` Depot workflow runs the task and opens a PR with the result (authenticating
through the repo's GitHub App so the PR still triggers CI); the task also runs manually.
CONTRIBUTING, the changelog README, the PR template, and the AGENTS hard rule now point at
fragments; this entry is the first user of the new flow.
