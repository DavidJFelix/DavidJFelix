---
name: panel-review
description: Run the repo's review personas -- design, product, engineering, testing, benchmark, tooling, security -- over a diff in parallel and report their verdicts side by side. Use when the user wants a persona review, a review panel, or names a persona ("what would the design reviewer say").
---

Persona review of the diff between `HEAD` and a fixed point. Each persona answers one question;
the panel reports them side by side without merging. For standards/spec conformance use `/review`
instead -- the panel judges quality, not compliance.

The personas live in `.agents/agents/`: `design-reviewer`, `product-reviewer`,
`engineering-reviewer`, `testing-reviewer`, `benchmark-reviewer`, `tooling-reviewer`,
`security-reviewer`. Their rubrics live in those files -- do not restate them in prompts.

## Process

### 1. Pin the diff

The fixed point is whatever the user said -- a commit SHA, branch, tag, `main`. If unspecified,
ask. Confirm `git rev-parse <fixed-point>` resolves and `git diff <fixed-point>...HEAD`
(three-dot) is non-empty before spawning anything. Note the commit list via
`git log <fixed-point>..HEAD --oneline`.

### 2. Seat the panel

If the user named personas, seat exactly those. Otherwise seat by what the diff touches, and
state which personas you skipped and why:

| Persona                | Seat when the diff touches                                    |
| ---------------------- | ------------------------------------------------------------- |
| `product-reviewer`     | always -- every diff has a scope question                      |
| `design-reviewer`      | UI components, styles, layouts, rendered content               |
| `engineering-reviewer` | source code beyond trivial edits                               |
| `testing-reviewer`     | any behavior change                                            |
| `benchmark-reviewer`   | a perf/size/quality claim, or a plan with a numeric goal       |
| `tooling-reviewer`     | tasks, scripts, CI, configs, or a new manual procedure         |
| `security-reviewer`    | auth, user input, external data, dependencies, deploy surface  |

### 3. Find the desire

Locate the motivating issue, plan (`docs/projects/<name>/plan.md`), or user request. If none
exists, that absence is passed along, not fixed here.

### 4. Spawn the panel in parallel

One message, one `Agent` call per seated persona, each with its `subagent_type` set to the
persona name. Give each the same brief: the diff command, the commit list, and the desire (or its
absence). Nothing else -- the persona files carry their own rubrics and report formats.

### 5. Aggregate

One `##` section per persona, findings verbatim or lightly cleaned -- never merged, reranked, or
deduplicated across personas; two personas flagging the same line is signal, not redundancy. End
with a verdict table: persona, one-line verdict, finding count. Do not compute an overall score
-- the user weighs the axes.
