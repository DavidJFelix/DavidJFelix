# revision.city Reviews

Make revision.city a standalone automated code reviewer. It is a GitHub App that reviews every pull
request on the repositories that install it. It posts findings as inline review comments, and it
replaces Warden in this repository. Spun out of the [revision.city](../revision-city/plan.md)
umbrella.

## Goals

- **Triggered by GitHub events, not CI.** A webhook starts the review; no workflow job runs it.
- **No configuration and no CLI.** Reviewers, severities, and thresholds are part of the product.
- **Re-runs cost only what changed.** Each chunk's model answer is saved; a re-run after a push pays
  only for chunks whose content, reviewer prompt, or model changed.
- **OpenRouter for models.** The model is an operator secret (`REVIEW_MODEL`), not a repository
  setting.
- **Works for any installation, runs only here for now.** Code takes the installation and repository
  from the event; an allowlist limits it to `DavidJFelix/DavidJFelix` until billing exists.
- **Clean-room.** Warden's behavior is the reference: per-hunk review, a severity gate, and inline
  findings. Its source is FSL-licensed. So none of it is read or copied, and the code does not name
  it.

## Design

- **Engine** (`src/reviews/lib/`):
  1. Split each file's patch into chunks of up to 200 diff lines.
  2. Run three reviewers (security, correctness, comments) on each chunk.
  3. Map findings back to new-file lines, one finding per line.
  4. Report `medium` and above, and fail on `high` and above.
- **Chunk-local line labels.** The prompt numbers lines from 1 inside the chunk, not by file line.
  An edit above a chunk then does not change its text, and its saved result stays valid.
- **Saved results** in D1 (`chunk_reviews`, `migrations/0001-chunk-reviews.sql`), keyed by a SHA-256
  of the model, reviewer, system prompt, and rendered chunk.
- **Runner: Cloudflare Workflows.** The webhook route verifies the signature and the allowlist,
  starts a Workflow instance, and returns 202 inside GitHub's 10-second window. The Workflow fetches
  the files, reviews each chunk in its own durable step (a retry never pays twice), and posts one
  review. Queues are not used: the Workflow already gives retries and fan-out.

## Phases

1. **Review engine.** Chunking, reviewer prompts, OpenRouter client, saved results, and
   `mise run review` to print findings for any PR from a terminal. Done in this project's first PR.
2. **GitHub App wiring.** D1 binding and database, webhook route with signature check and allowlist,
   the Workflow, installation tokens, and the posted review: inline comments, a summary, and a check
   run that fails on `high`. A `Revision City` label re-runs a review on the current head.
3. **Retire Warden.** After a few PRs where both reviewers agree, delete `warden.toml`,
   `.depot/workflows/ci-warden.yml`, and the summary script, and update CONTRIBUTING and the
   [review consolidation](../review-consolidation/plan.md) plan.

Later: billing per installation, then open the allowlist.

## Open questions

- Whether the comments reviewer should read the repository's own comment style guide when one exists
  (this repository's `comment-review` skill is stricter than the generic reviewer).
