# LLM Automation Migration

## Status (2026-06-29)

**Obsolete — pending a decision.** The CI/CD migration to Depot removed both Claude
bot workflows from the repo: `bot-claude.yml` and `bot-claude-code-review.yml` had no
Depot equivalent and were deleted. The original migration target no longer exists, so
this project is moot as written. Either **close it** (nothing left to migrate) or
**repurpose it** as "introduce a cheaper LLM review bot on Depot" — a fresh greenfield
effort. Awaiting that call; the prior status is kept below for context.

## Status (2026-06-11)

**Deferred — worth doing, not now.** The motivation stands (avoid running
Claude Code in CI tasks), but this sits behind app health / preview
infrastructure and the active hygiene work.

Scope (finalized 2026-06-18): the `renovate-rollout` project retires
`cron-dependency-freshness.yml` outright, so it's no longer a migration target —
**`bot-claude-code-review.yml` is the sole workflow to move.** Still deferred behind the active
work.

## Goal

Move the repo's unattended LLM-driven GitHub Actions off `anthropics/claude-code-action` and onto a cheaper runtime — `pi-core` (on bun) or `opencode` — so programmatic invocations don't run on Anthropic-billed Claude.

Interactive work (David ↔ Claude in Claude Code) stays on Claude. This is about scheduled and event-triggered automation only.

## Rationale

- Claude API pricing makes the cron sweep and per-PR review actions expensive to run unattended
- Open / self-hostable agent runtimes have caught up enough for these specific workloads (skill execution, PR review)
- Skills are designed to be model-portable; the migration is mostly about the runner, not the prompts

## In-scope workflows

- ~~`bot-claude-code-review.yml`~~ — was the sole migration target; **removed entirely in the
  2026-06-29 Depot migration** (no Depot equivalent), so there is nothing left to migrate.
- ~~`cron-dependency-freshness.yml`~~ — dropped earlier: the `renovate-rollout` project
  retires this workflow entirely (Renovate owns dependencies), so there's nothing to migrate.
- ~~`bot-claude.yml`~~ — interactive mention bot; also **removed in the 2026-06-29 Depot migration**.

## Implementation

### Phase 1: Pick the runtime

Evaluate `pi-core` (bun) vs `opencode` vs other viable options. Criteria:

- Skill compatibility: does it understand `.claude/skills/` (or how much porting is required)?
- Tool access: GitHub MCP, git, language-specific package managers, mise
- Model backend flexibility: local models, cheaper API providers, mix
- Maturity for unattended use (auth, secrets, retry, logging)
- Maintenance cost — we don't want to own the runtime

Pick one. Document the tradeoffs.

### Phase 2: Port the dependency-freshness skill

- Port `.claude/skills/dependency-freshness/SKILL.md` to the chosen runtime's skill format
- Verify the port end-to-end against a single ecosystem first (npm, since djf.io is the most active)
- Migrate the cron workflow

### Phase 3: Port the review action

- Replicate the current PR-review prompt/skill on the new runtime
- Migrate `bot-claude-code-review.yml`
- Keep behavior parity: same trigger, same review style, similar latency

### Phase 4: Document

- Update `CLAUDE.md` / `AGENTS.md` so the next person knows which runtime owns which workflow
- Note which workflows stayed on Claude and why

## Working Notes

- David is migrating off Claude for cost reasons, not capability reasons. Direction is "good enough on a cheaper runner", not "best agent for the job".
- Skills are the portable unit. The freshness skill in particular was written to be runtime-agnostic; treat that as the canary.
- Claude (this assistant) is helping with the migration even though the destination isn't Claude — the irony is acknowledged.
