### feat(agents): add the author-side agent team -- ten personas for orchestrated development

The six review personas now have an author side: ten new agent definitions in `.agents/agents/`
(tracked symlinks in `.claude/agents/`) forming an orchestrable team. The director is the user's
single point of contact -- it forms verified goals, staffs and briefs teammates with closed/open
dimension discipline, keeps the work ledger in `docs/projects/`, and referees engineered tension
(asymmetric briefs, same-message dispatch, fresh-eyes fix loops, author recusal) without ever
deciding a technical dispute itself. Around it: a planner that decomposes goals into independently
verifiable steps, a product voice that cuts scope to just-enough before work is staffed, a
researcher that verifies prior art instead of remembering it, an architect that consolidates
recurring problems into libraries ("solving problems for problem solvers," not DRY compliance), a
developer that builds to the brief at ponytail lite intensity, an elite engineer that runs the
ponytail ladder at ultra to delete what the present does not earn, an adversarial tester briefed to
prove the code does not work, and a platform engineer that owns the Cloudflare/CI paved road. A
seventh judge, security-reviewer, joins the review bench in the existing reviewer format.

Author/judge sibling contracts pair each builder with its reviewer (product/product-reviewer,
tester/testing-reviewer, platform-engineer/tooling-reviewer), and the architect/elite-engineer seam
is written into both files as designed disagreement settled by the deep-module test or the
director's dispute rule. Pattern informed by ALT-F4's opencode agent org (tier routing, brief
discipline, verdict ladders) adapted for Claude Code's native teammate messaging.
