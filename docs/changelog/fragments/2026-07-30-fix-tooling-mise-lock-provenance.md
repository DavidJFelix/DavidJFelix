### fix(tooling): drop provenance assertions from mise.lock to unblock installs

Every CI job -- and local `mise install` -- began failing with
`Lockfile requires github-attestations provenance for aqua:biomejs/biome@2.5.5 but no verification was used`.
The lockfile carried provenance records (github-attestations on actionlint, biome, pinact, pnpm,
zizmor; SLSA on ghalint) written by an environment that could verify them, and a newer mise release
started refusing to install whenever the lock demands provenance that the installing machine does
not verify -- its anti-downgrade posture. Verification needs GitHub API access at install time,
which the Depot runners and sandboxed agent sessions do not have, so the enforcement bricked every
environment at once.

The fix strips the provenance assertions and keeps every sha256 checksum -- the checksums remain the
effective pin against artifact swaps and downgrades. Re-enabling provenance is a deliberate
follow-up, not a revert: it requires deciding that every installing environment (CI, agent
sandboxes, laptops) can reach the GitHub attestations API, then re-locking with verification on.
Until then, lockfile maintenance runs from verifying environments would re-introduce the records and
re-break the fleet, so watch for provenance lines returning in `.config/mise.lock` on renovate
lock-maintenance PRs.
