# f311x

A small chat app on Cloudflare — TanStack Start front end, deployed via Alchemy v2.
"f311x" is the agent. Today it builds and deploys; the chat backend isn't wired yet.

## Current state (2026-06-03)

- **Builds + deploys.** TanStack Start client app (`src/routes`, `src/components/ui`).
  `pnpm typecheck`, `pnpm build`, and `pnpm test` are green, and CI gates all of
  them (`.github/workflows/ci_f311x.yml`).
- **Chat is a shell.** `src/routes/index.tsx` posts to `/agents/chat-agent/default`,
  which has no backend — sending a message goes nowhere yet.
- The earlier Effect-native scaffold (effects services, a custom Vectorize provider,
  Workflows, Sandbox, agent tools) was removed: it never deployed and had drifted
  into a non-building state. See #202 and the 2026-06-03 progress note for the
  teardown.

## Next — make the chat actually work

- [ ] Wire the smallest agent backend the UI can talk to — something that answers
      `/agents/chat-agent/default` and streams a reply.
- [ ] Choose the model path (direct provider vs. a gateway) once there's a working
      loop to put behind it.
- [ ] Add a test with each new surface. typecheck + build + vitest already gate
      every PR; keep them green.

## Stack

- TanStack Start (Vite, file-based routing) + React 19
- Tailwind v4 + shadcn-style components
- Alchemy v2 for deploy + bindings (`alchemy.run.ts`, which uses `effect`)
- Vitest + Testing Library + jsdom for tests

## Constraints

- Keep it small. Add a binding or dependency only when something actually uses it.
- Every new surface ships with a test, and CI stays green — no silent regressions.
