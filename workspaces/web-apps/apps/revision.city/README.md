# revision.city

A GitHub diff viewer under `/diffs` and an automated pull request reviewer, on Cloudflare Workers.
The plans: [revision.city](../../../../docs/projects/revision-city/plan.md) and
[revision.city Reviews](../../../../docs/projects/revision-city-reviews/plan.md).

## Set up

1. Run `bun install` in `workspaces/web-apps`, then `bun run prepare` here (Panda codegen).
2. Copy `.dev.vars.example` to `.dev.vars` and fill in the values that you need. Each name is
   optional: without the two `GITHUB_APP_CLIENT_*` names the sign-in routes answer 503, and without
   `GITHUB_WEBHOOK_SECRET` the webhook answers 503. Placeholders for the two sign-in names are
   enough for the sign-in e2e tests.
3. Make the local D1 database: `bun x wrangler d1 migrations apply revision-city --local`. Run it
   again after a pull request adds a migration in `drizzle/`.

## Run and test

| Command             | What it does                                                     |
| ------------------- | ---------------------------------------------------------------- |
| `bun run dev`       | The dev server on port 3005                                      |
| `mise run test`     | Vitest with coverage (fails under the coverage limits)           |
| `mise run smoke`    | Builds, then checks that `/` and `/diffs` serve a full bundle    |
| `mise run test:e2e` | Builds, then runs the Playwright tests on a local `vite preview` |
| `bun run review`    | Reviews one pull request and prints the findings                 |
| `mise run check`    | Typecheck, lint, format, test and build                          |

`bun run review owner/repo#123` needs `OPENROUTER_API_KEY` and `REVIEW_MODEL` in the shell, and
`GITHUB_TOKEN` is optional. It posts nothing, but it spends model money on each chunk.

## Build-time names

The build inlines these optional names; each integration stays off without its value:
`VITE_PUBLIC_SENTRY_DSN`, `VITE_PUBLIC_POSTHOG_KEY`, `VITE_PUBLIC_SITE_URL` (preview builds) and
`VITE_PUBLIC_DEPLOY_ENV` (from `CLOUDFLARE_ENV`). See `src/env.d.ts`.

## The review webhook

GitHub sends the App's events to `POST /api/github/webhook`. The route checks the
`x-hub-signature-256` header, an HMAC-SHA256 of the raw body with `GITHUB_WEBHOOK_SECRET`, and
answers 401 when it does not match. A signed `ping` event is a safe local test: the route answers
202 and starts no review.

**Warning**: a signed `pull_request` delivery to a local worker uses the real App key. It creates a
real check run and real comments on that pull request, and it spends model money. Use
`bun run review` first.

The review path on main is the webhook, then a Cloudflare Workflow (`src/reviews/`), then D1 for
each saved chunk review. A harness reviewer in a separate Worker will replace it; see the
[reviews plan](../../../../docs/projects/revision-city-reviews/plan.md).

Production sets the same secrets with `wrangler secret put`. The dev worker (`[env.dev]` in
`wrangler.toml`) has its own GitHub App and no reviews.
