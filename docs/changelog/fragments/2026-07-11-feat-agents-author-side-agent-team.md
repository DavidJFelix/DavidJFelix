### feat(agents): add the author-side agent team -- ten personas for orchestrated development

The review bench gains an author side: ten new agent definitions in `.agents/agents/` (tracked
symlinks in `.claude/agents/`) forming an orchestrable team. The director is the user's single point
of contact -- it forms verified goals, staffs and briefs teammates with closed/open dimension
discipline, keeps the work ledger in `docs/projects/`, and referees engineered tension (asymmetric
briefs, same-message dispatch, fresh-eyes fix loops, author recusal) without ever deciding a
technical dispute itself. Around it: a planner that decomposes goals into independently verifiable
steps, a product voice that cuts scope to just-enough before work is staffed, a researcher that
verifies prior art instead of remembering it, an architect that consolidates recurring problems into
libraries ("solving problems for problem solvers," not DRY compliance), a developer that builds to
the brief at ponytail lite intensity, a simplifier that runs the ponytail ladder at ultra to delete
what the present does not earn, an adversarial tester briefed to prove the code does not work, and a
platform engineer that owns the Cloudflare/CI paved road. A seventh judge, security-reviewer, joins
the review bench in the existing reviewer format.

Author/judge sibling contracts pair builders with reviewers (product/product-reviewer,
tester/testing-reviewer, platform-engineer/tooling-reviewer, architect +
simplifier/engineering-reviewer, back-referenced from both sides), and the architect/simplifier seam
is written into both files as designed disagreement settled by the deep-module test or the
director's dispute rule. Shared doctrine is factored into two new style guides -- ponytail.md (the
frugality ladder and persona intensities) and evidence-discipline.md (verified-vs-assumed claims,
cite-don't-claim returns) -- and the team is wired into its surfaces: AGENTS.md documents the team
and the seven-judge bench, panel-review seats the new security judge, and `.agents/agents/` joins
the spell gate. A new `bin/check-agents.ts` (with co-located tests, fronted by
`mise run check:agents` and a ci-repo job) gates the artifact class itself: strict-YAML frontmatter
with name/filename agreement and a bidirectional `.claude/agents/` symlink mirror -- the two defect
classes that regress silently. Pattern informed by ALT-F4's opencode agent org (tier routing, brief
discipline, verdict ladders) adapted for Claude Code's native teammate messaging.
