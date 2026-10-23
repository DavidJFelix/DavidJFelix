# revision.city Reviews

Make revision.city a standalone automated code reviewer. It is a GitHub App that reviews every pull
request on the repositories that install it. It posts findings as inline review comments, and it
replaces Warden in this repository. This project started as part of
[revision.city](../revision-city/plan.md).

## Goals

- **Triggered by GitHub events, not CI.** A webhook starts the review; no CI job runs it.
- **No configuration and no user-facing CLI.** Reviewers, severities, and thresholds are part of the
  product.
- **Re-runs cost only what changed.** The app saves the model's answer for each chunk review. A
  re-run after a push pays only for a chunk review that has no saved answer, or whose tools read a
  path that changed. A push that adds or removes a file changes the file list in every prompt, so
  each chunk review pays again.
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
  3. Map findings back to new-file lines. When findings end on the same line, keep the most severe.
  4. Report checked findings at `medium` and above. Fail on a checked finding at `high` and above,
     or when a chunk review fails.
- **Chunk-local line labels.** The prompt numbers lines from 1 inside the chunk, not by file line. A
  chunk that only moves in the file, for example after a rebase, keeps its text and its saved
  result. A push that grows or shrinks a hunk above it in the same file can still move the chunk
  boundaries.
- **Tools.** Each reviewer can call `read_file`, `list_directory`, and `read_definition` on the pull
  request's head commit, for up to 4 rounds in each chunk review. The tools read through the GitHub
  API, so the Worker needs no container. `read_definition` uses the Lezer entity extractor of the
  Symbols tab, not a code index.
- **Saved results** in D1 (`chunk_reviews`, a drizzle schema with its migrations in `drizzle/`),
  keyed by a SHA-256 of the scope, model, reviewer, system prompt, and user prompt (the file list,
  then the rendered chunk). The GitHub App uses the installation as the scope. A saved result
  records each path that its tools read, with the path's object id. A run uses the result again only
  while each of those paths keeps its id.
- **Runner: Cloudflare Workflows.** The webhook route (`/api/github/webhook`) verifies the signature
  and the allowlist, starts a Workflow instance, and returns 202 inside GitHub's 10-second window.
  The instance creates a `Revision City` check run and lists the files. It reviews the chunks in
  durable steps of 3 chunk reviews, because Cloudflare keeps at most 1 MiB for each step result. A
  retry pays only for the chunk reviews that failed. Then, when there are new findings, the instance
  posts them as inline comments in one review. Last, it completes the check run. When the pull
  request closes or gets a new head, the instance posts nothing and marks the check run neutral.
  Queues are not used: the Workflow already gives retries and fan-out.
- **Triggers.** These actions of a `pull_request` event start a review: `opened`, `synchronize`,
  `reopened`, and `ready_for_review`. Each review costs model tokens, so drafts, pull requests that
  bots open, and authors who are not an owner, member, or collaborator get no automatic review.
  Adding the `Revision City` label starts a review of any open pull request, at its current head.
  The review removes the label, so adding it again starts another review.
- **Untrusted text.** The pull request's author can steer the reviewers, so the prompts treat the
  diff and the files as text to review. In posted text, a zero-width space goes after `@`, `#`,
  `GH-`, `<`, and the `&` of an entity. So model text and file paths cannot mention users, reference
  issues, or add HTML. Links to github.com go through redirect.github.com, so they do not show in
  the timeline of the linked issue. The check run is not a security gate by itself.
- **Posted comments.** Each comment starts with a fingerprint, and a run does not post a finding
  again on a line where the app already posted it. The finding's body goes last, so a code block
  that it leaves open cannot take in the suggestion.
- **Limits.** For each pull request, at most 150 chunks and 700,000 bytes of paths and patches get a
  review. A file whose diff is longer than 1,500 lines gets no review. One review posts at most 50
  new comments. The check run lists every finding, and it cuts its text at 65,000 characters, below
  GitHub's limit of 65,535.

## Phases

1. **Review engine.** Chunking, reviewer prompts, OpenRouter client, saved results, and
   `mise run review` to print findings for any PR from a terminal. Done in this project's first PR.
2. **GitHub App wiring.** The tool loop, the webhook route, the Workflow, installation tokens, the
   posted review, the check run, and the `Revision City` label, built as a series of small PRs. It
   needs the one-time setup in #790: the D1 database and its migrations, the app's permissions and
   webhook, and the secrets.
3. **Retire Warden.** After a few PRs where both reviewers agree, delete `warden.toml`,
   `.depot/workflows/ci-warden.yml`, and the summary script, and update CONTRIBUTING and the
   [review consolidation](../review-consolidation/plan.md) plan.

Later: a manual review request that can go over the 1,500-line limit, then billing per installation,
then open the allowlist. `REVIEW_MODEL` is not secret, so it becomes a plain variable instead of a
secret, and later a config value.

## Open questions

- Whether the comments reviewer should read the repository's own comment style guide when one exists
  (this repository's `comment-review` skill is stricter than the generic reviewer).
