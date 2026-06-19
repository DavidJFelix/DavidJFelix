# f311x

A small chat app on Cloudflare — TanStack Start front end, deployed via Alchemy v2.
"f311x" is the agent. Today it builds and deploys; the chat backend isn't wired yet.

## Current state (2026-06-14)

- **Production restored and verified.** `f311x.com` and `www.f311x.com` serve
  a real production bundle that hydrates (hashed `/assets/index-*.js` entry
  resolves; no dev virtual entry), and the chat echo streams end to end
  (`RUN_STARTED → TEXT_MESSAGE_* → RUN_FINISHED`). Verified live after the
  2026-06-14 deploy (CD run 27504856773).
- **What had been wrong.** Three stacked failures — no ingress, a broken
  deploy toolchain, and a dev-mode artifact — were fixed in #221 (merged
  2026-06-11). One blocker outlived the merge: a leftover **dev-stage worker**
  still held `f311x.com` / `www.f311x.com` (claimed before the prod-only
  domain gate landed on 2026-06-12), so every prod deploy failed at custom-
  domain reconciliation and the dev worker kept serving the broken page.
  Detaching the domains from it (2026-06-14) let prod claim ingress. The #220
  token-scope concern was a red herring — no zone scope was needed. Full
  story: 2026-06-11 and 2026-06-14 progress notes.
- **The smoke test now covers the chat loop**, not just hydration
  (`bin/smoke-test.ts`), so "deployed but dead" fails the CD gate.

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

## Next — make the chat real, with error visibility

Production is restored and verified (2026-06-14); stabilization is done. The live work is a real
model behind the chat loop, plus error visibility for the Worker.

- [x] Diagnose why prod is broken; capture the symptom and root cause in a
      progress note. (2026-06-11: no ingress — no custom domain on the Worker,
      no DNS records in the zone. See the progress note.)
- [x] Restore prod. #221 merged (2026-06-11); the remaining blocker was a
      leftover dev worker holding the custom domains — detached 2026-06-14,
      redeployed (CD run 27504856773), and verified f311x.com / www hydrate and
      the chat echo streams. No zone scope was needed.
- [x] Make breakage visible pre-merge: per-PR preview deploy + smoke test. f311x
      was the proving ground; the per-PR preview pipeline shipped repo-wide
      2026-06-17 (see the changelog). The post-deploy smoke test also gates CD and
      covers hydration + the chat stream.
- [x] Wire the smallest agent backend the UI can talk to — an echo stub answers
      `/agents/chat-agent/default` and streams the reply as AG-UI SSE events
      (`RUN_STARTED` → `TEXT_MESSAGE_*` → `RUN_FINISHED`). Backed by
      `src/lib/chat-agent.ts`; the route is `src/routes/agents/chat-agent/default.ts`.
- [ ] Swap the echo for a real model — the live priority now that prod is stable.
      Choose the model path (direct provider vs. AI Gateway); the wire contract and
      route stay the same, only `chatAgentStream` changes.
- [ ] Error visibility for the Worker — now delivered by the active
      [Sentry Integration](../sentry-integration/plan.md) rollout, which f311x
      leads, rather than a one-off slice. "Why is it broken" shouldn't require a
      local repro.
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

**Custom domains (resolved 2026-06-14 — no extra scope needed)**: attaching
`f311x.com` / `www.f311x.com` to the Worker creates DNS records in the zone.
This turned out to need **no additional zone scope** — the 2026-06-14 prod
deploy (CD run 27504856773) attached both domains and created DNS with the
existing token; it authenticated cleanly and the only failure mode seen was a
hostname collision with a leftover dev worker, never a `10000` auth error. If
a future deploy ever does fail with a generic `10000 "Authentication error"`
at the domain step, the thing to try is granting **Zone · Workers Routes ·
Edit** and/or **Zone · DNS · Edit** scoped to f311x.com. The f311x workflow
uses its own `F311X_CLOUDFLARE_API_TOKEN` secret, not the shared
`CLOUDFLARE_API_TOKEN` the wrangler apps use.

## Constraints

- Keep it small. Add a binding or dependency only when something actually uses it.
- Every new surface ships with a test, and CI stays green — no silent regressions.
