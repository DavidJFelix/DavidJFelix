### docs(tooling): plan the bun.lock merge queue

New merge-queue project: investigation and phased plan for ending the multi-PR `bun.lock` conflict
pile-up. The investigation verified a deterministic resolution recipe on bun 1.3.11 (merge main,
take main's lockfile, `bun install --lockfile-only` -- yields exactly the PR's delta, byte-identical
across runs) and established that bare `bun install` on a conflicted lockfile silently re-resolves
everything from scratch. The plan phases the fix: a lockfile-aware `bot-update-branch` Depot
workflow, Renovate automerge for the grouped update PRs, and a GitHub App queue on Cloudflare
Workers with a Durable Object per base branch. GitHub's native merge queue is unavailable on
user-owned repos and rejects conflicted PRs anyway, and external queue apps stay out per the
build-in-repo preference.
