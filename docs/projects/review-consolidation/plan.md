# Review Consolidation

Consolidate the repo's code-review and quality-gate surfaces around **Warden** as the single
canonical automated reviewer. Everything else — the built-in Claude commands, the local `/review`
skill — is positioned to _complement_ Warden, not compete with or duplicate it.

## Thesis

**Warden is the path forward.** It is the automated gate that runs on every PR. Other review tools
keep their place only where they do something Warden does not; where they overlap, Warden wins and
the other tool steps back. No two tools should post competing findings on the same diff.

## Why now

- Warden landed 2026-06-30 (`warden.toml`, `.depot/workflows/ci-warden.yml`, CLI pinned via mise —
  see the [changelog](../../changelog/2026-06.md)). It runs the built-in `security-review` and
  `code-review` skills on every non-draft PR.
- The 2026-06 Depot migration deleted the old `bot-claude-code-review.yml` auto-reviewer, so the
  **automated PR-review slot has been empty since**. Warden refills it — it is a replacement, not a
  duplicate.
- Without an explicit convention, three review surfaces (Warden, the built-in `/code-review` +
  `/security-review`, and the local `/review` skill) overlap in topic and risk duplicate inline
  comments, unclear ownership, and double model spend.

## The map (roles, so they complement)

| Tool                                        | Slot                        | When                       | Posts to PR?                 |
| ------------------------------------------- | --------------------------- | -------------------------- | ---------------------------- |
| **Warden**                                  | Canonical automated gate    | Every non-draft PR (CI)    | **Yes** — sole source        |
| Built-in `/code-review`, `/security-review` | Local inner loop, on-demand | Before you push            | No (run without `--comment`) |
| `/review` (Standards + Spec)                | Holistic, on-demand         | When judging a branch/spec | No                           |

The built-in commands are **not repo artifacts** — they ship with Claude Code, cost nothing when
idle, and are invoked at will. There is nothing to delete; consolidation here is about _convention_,
not file removal.

## Phases

1. **Land Warden.** Config, workflow, CLI pin, changelog — done 2026-06-30. Gate goes live once the
   `WARDEN_MODEL` + `WARDEN_OPENROUTER_API_KEY` secrets exist
   ([#302](https://github.com/DavidJFelix/DavidJFelix/issues/302)). Verify on a real PR (findings
   post, check gates as configured). Confirm `persist-credentials: false` holds — if Warden can't
   read the diff, add the documented `artipacked` suppression.
2. **Document the division of labor.** `CONTRIBUTING.md` → "Code review" section: Warden owns posted
   comments; run the built-ins locally without `--comment`; keep `/review`. Done this session.
3. **Encode the repo's own standards as Warden skills.** The real consolidation payoff: author
   repo-specific Warden skills (agent-skill spec) that enforce _this_ repo's conventions —
   kebab-case filenames, bun-not-bash, no `describe` blocks in tests, Prettier-owns-Markdown, the
   config placement tiers, the `sed`/`perl` ban. This folds the house-rules knowledge that
   `/review`'s Standards axis carries today into the automated gate, so Warden enforces conventions,
   not just generic correctness.
4. **Reassess `/review` overlap.** Once Warden encodes standards, decide whether `/review`'s
   _Standards_ axis is still needed or is now subsumed by the gate. Keep the _Spec_ axis regardless
   — Warden does not check conformance to the originating issue/PRD. Collapse surfaces only where
   they genuinely duplicate.
5. **Tune and retire.** Calibrate `failOn` / `reportOn`; decide always-on vs. gated behind a
   `Warden` label based on real cost and noise (the trigger already includes `labeled`). Confirm no
   other stale review automation remains. Capture the outcome in the changelog and delete this
   project directory.

## Non-goals

- Removing the built-in `/code-review` / `/security-review` commands — they are on-demand, free when
  idle, and useful as a pre-push inner loop.
- Replacing human judgment. Warden gates; it does not approve.

## Links

- Config: [`warden.toml`](../../../warden.toml) · Workflow:
  [`.depot/workflows/ci-warden.yml`](../../../.depot/workflows/ci-warden.yml)
- Changelog: [2026-06](../../changelog/2026-06.md) (2026-06-30) · Secrets issue:
  [#302](https://github.com/DavidJFelix/DavidJFelix/issues/302)
- Convention: [CONTRIBUTING.md → Code review](../../../CONTRIBUTING.md#code-review)
- Local `/review` skill: `.agents/skills/review/SKILL.md`
- Warden guide: https://warden.sentry.dev/guide
