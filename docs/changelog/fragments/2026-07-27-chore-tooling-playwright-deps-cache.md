### chore(tooling): stop playwright jobs from hitting the apt mirrors every build

The Playwright CI steps restored cached browsers but still ran `playwright install-deps` against the
apt mirrors on every build -- roughly six minutes of `apt-get update` plus package downloads per
run. A new `setup-playwright` composite action now also caches the downloaded `.deb` archives, keyed
on the Playwright version like the browser cache, and warm runs install them with `dpkg` in seconds
without touching the network (`bin/install-playwright-deps.ts`); a cold or stale cache falls back to
the real `playwright install-deps` and repopulates the archive cache. The action replaces the
hand-rolled Playwright steps in `ci-djf-io`, `cd-preview-f311x`, and both update-snapshots bots --
the bots previously had no Playwright caching at all. The preview composites inline the same steps
instead of nesting the action: run steps inside a nested composite do not inherit the job's default
working directory, so the version resolve and `pnpm exec` would run at the repo root and fail.
