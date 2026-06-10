# f311x

A small chat app on Cloudflare — TanStack Start front end, deployed via Alchemy v2.
"f311x" is the agent. Today it builds and deploys; the chat backend isn't wired yet.

## Current state (2026-06-08)

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

## Next — make the chat actually work

- [x] Wire the smallest agent backend the UI can talk to — an echo stub answers
      `/agents/chat-agent/default` and streams the reply as AG-UI SSE events
      (`RUN_STARTED` → `TEXT_MESSAGE_*` → `RUN_FINISHED`). Backed by
      `src/lib/chat-agent.ts`; the route is `src/routes/agents/chat-agent/default.ts`.
- [ ] Swap the echo for a real model. Choose the model path (direct provider vs.
      AI Gateway) now that there's a working loop to put behind it. The wire
      contract and route stay the same — only `chatAgentStream` changes.
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

## Constraints

- Keep it small. Add a binding or dependency only when something actually uses it.
- Every new surface ships with a test, and CI stays green — no silent regressions.
