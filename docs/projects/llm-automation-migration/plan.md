# LLM Automation Migration

## Goal

Move the repo's unattended LLM-driven GitHub Actions off `anthropics/claude-code-action` and onto a cheaper runtime — `pi-core` (on bun) or `opencode` — so programmatic invocations don't run on Anthropic-billed Claude.

Interactive work (David ↔ Claude in Claude Code) stays on Claude. This is about scheduled and event-triggered automation only.

## Rationale

- Claude API pricing makes the cron sweep and per-PR review actions expensive to run unattended
- Open / self-hostable agent runtimes have caught up enough for these specific workloads (skill execution, PR review)
- Skills are designed to be model-portable; the migration is mostly about the runner, not the prompts

## In-scope workflows

- `.github/workflows/cron_dependency_freshness.yml` — weekly freshness sweep
- `.github/workflows/bot_claude_code_review.yml` — PR review on open/update
- `.github/workflows/bot_claude.yml` — keep on Claude for now (interactive mention bot); revisit after the other two land

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
- Migrate `bot_claude_code_review.yml`
- Keep behavior parity: same trigger, same review style, similar latency

### Phase 4: Document

- Update `CLAUDE.md` / `AGENTS.md` so the next person knows which runtime owns which workflow
- Note which workflows stayed on Claude and why

## Working Notes

- David is migrating off Claude for cost reasons, not capability reasons. Direction is "good enough on a cheaper runner", not "best agent for the job".
- Skills are the portable unit. The freshness skill in particular was written to be runtime-agnostic; treat that as the canary.
- Claude (this assistant) is helping with the migration even though the destination isn't Claude — the irony is acknowledged.
