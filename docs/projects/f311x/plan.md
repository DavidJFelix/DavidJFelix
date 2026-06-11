# f311x

A small chat app on Cloudflare — TanStack Start front end, deployed via Alchemy v2.
"f311x" is the agent. Today it builds and deploys; the chat backend isn't wired yet.

## Current state (2026-06-11)

- **Diagnosed: the app has no ingress — f311x.com was never wired to the
  Worker.** The prod Worker (`f311x-website-prod-…`) deployed fine on
  2026-06-06, but `alchemy.run.ts` never set the `domain` option, so no custom
  domain is attached, the f311x.com zone (on Cloudflare, same account) has zero
  DNS records, and the site never resolves. Not a runtime crash — requests
  never reach the Worker. "Green deploy, broken prod" because the pipeline
  verifies upload, not reachability. Fix in flight: `domain: ['f311x.com',
  'www.f311x.com']` on the `Cloudflare.Vite` resource; Cloudflare materializes
  the DNS records when the custom domains attach on the next prod deploy. One
  open risk: the deploy token may need a zone scope to attach domains — see the
  token-scopes section. Details in the 2026-06-11 progress note.

## Earlier state (2026-06-08)

- **Builds + deploys.** TanStack Start client app (`src/routes`, `src/components/ui`).
  `pnpm typecheck`, `pnpm build`, and `pnpm test` are green, and CI gates all of
  them (`.github/workflows/ci-f311x.yml`).
- **CD wired.** `.github/workflows/cd-deploy-f311x.yml` runs `alchemy deploy
  --stage prod` on push to main, using the shared `CLOUDFLARE_*` secrets (CI is
  gated at merge via branch protection, not the deploy workflow). The first prod
  deploy succeeded on 2026-06-06, after granting the CI token **Secrets Store:
  Edit** — the Alchemy CLI needs it to read/write `Cloudflare.state()`, which is a
  CLI state scope, not a resource scope. See the 2026-06-06 progress note.
- **Chat echoes.** `src/routes/index.tsx` posts an AG-UI `RunAgentInput` to
  `/agents/chat-agent/default`; a TanStack Start server route
  (`src/routes/agents/chat-agent/default.ts`) answers with a Server-Sent Events
  stream that echoes the message back, token by token. No model is wired yet —
  the reply is a stub built in `src/lib/chat-agent.ts` (unit-tested). See the
  2026-06-08 progress note.
- The earlier Effect-native scaffold (effects services, a custom Vectorize provider,
  Workflows, Sandbox, agent tools) was removed: it never deployed and had drifted
  into a non-building state. See #202 and the 2026-06-03 progress note for the
  teardown.

## Next — restore the app, then make the chat real

Stabilize before building (reprioritized 2026-06-11).

- [x] Diagnose why prod is broken; capture the symptom and root cause in a
      progress note. (2026-06-11: no ingress — no custom domain on the Worker,
      no DNS records in the zone. See the progress note.)
- [ ] Restore ingress: deploy the `domain` binding (merge to main triggers CD,
      or `workflow_dispatch` re-runs it) and verify https://f311x.com loads.
      May require granting the deploy token a zone scope first.
- [ ] Make breakage readable: error visibility for the Worker (Cloudflare
      logs/tail and/or the f311x slice of
      [Sentry Integration](../sentry-integration/plan.md) pulled forward) so
      "why is it broken" doesn't require a local repro.
- [ ] Make breakage visible pre-merge: per-PR preview deploy + smoke test —
      f311x is the first target of the
      [preview-deployments](../preview-deployments/plan.md) project.
- [x] Wire the smallest agent backend the UI can talk to — an echo stub answers
      `/agents/chat-agent/default` and streams the reply as AG-UI SSE events
      (`RUN_STARTED` → `TEXT_MESSAGE_*` → `RUN_FINISHED`). Backed by
      `src/lib/chat-agent.ts`; the route is `src/routes/agents/chat-agent/default.ts`.
- [ ] Swap the echo for a real model. Choose the model path (direct provider vs.
      AI Gateway) now that there's a working loop to put behind it. The wire
      contract and route stay the same — only `chatAgentStream` changes.
      Behind stabilization as of 2026-06-11.
- [ ] Add a test with each new surface. typecheck + build + vitest already gate
      every PR; keep them green.

## Stack

- TanStack Start (Vite, file-based routing) + React 19
- Tailwind v4 + shadcn-style components
- Alchemy v2 for deploy + bindings (`alchemy.run.ts`, which uses `effect`)
- Vitest + Testing Library + jsdom for tests

## CI deploy — required Cloudflare token scopes

`cd-deploy-f311x.yml` runs `alchemy deploy --stage prod` with the shared
`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` secrets (account
`184b85b87e2289c4b18d7aaf41cd53cd`). The token must carry:

- **Secrets Store · Edit** — Alchemy's `Cloudflare.state()` reads/writes deploy
  state via Cloudflare Secrets Store, so the CLI 401s at startup without it. This
  gates the CLI's *state access*, not a resource — and its absence is what failed
  the first deploy. Cloudflare reports it as a generic `10000 "Authentication
  error"`, which misleadingly looks like a bad token or a missing R2 scope.
- **Workers Scripts · Edit** — deploy the Worker (same scope wrangler uses for the
  other apps, so this was already present).
- **Workers R2 Storage · Edit** — the `Uploads` / `AgentWorkspace` buckets.
- **AI Gateway · Edit** — the `Gateway` AI Gateway.

Only **Secrets Store: Edit** was missing on the first run; the resource scopes were
already granted. See the Alchemy CI/CD guide and the 2026-06-06 progress note.

**Custom domains (unverified scope)**: attaching `f311x.com` / `www.f311x.com`
to the Worker creates DNS records in the zone. Cloudflare doesn't document the
exact token permission for `PUT /accounts/:id/workers/domains`; if the deploy
fails with another generic `10000 "Authentication error"`, grant the token
**Zone · Workers Routes · Edit** and/or **Zone · DNS · Edit** scoped to
f311x.com. Note the f311x workflow uses its own `F311X_CLOUDFLARE_API_TOKEN`
secret, not the shared `CLOUDFLARE_API_TOKEN` the wrangler apps use.

## Constraints

- Keep it small. Add a binding or dependency only when something actually uses it.
- Every new surface ships with a test, and CI stays green — no silent regressions.
