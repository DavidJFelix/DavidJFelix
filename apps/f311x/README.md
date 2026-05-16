# f311x

Effect-native AI agent app on Cloudflare. Source of truth for scope and decisions: [`docs/projects/f311x/plan.md`](../../docs/projects/f311x/plan.md).

## Stack

- TanStack Start on Cloudflare Workers
- Alchemy v2 for infrastructure (`alchemy.run.ts`)
- Cloudflare Agents SDK (`AIChatAgent` DO subclass)
- Effect-TS for async orchestration
- TanStack AI tools + Vercel AI SDK (scoped to `onChatMessage`)
- R2, Vectorize, Workflows, Dynamic Workflows, Sandbox, AI Gateway

## Getting started

```bash
pnpm install
pnpm dev
```

App boots on `http://localhost:3000`.

## Scripts

See [AGENTS.md](./AGENTS.md) for the full table.

| | |
|---|---|
| `pnpm dev` | Vite dev server |
| `pnpm build` | Production build |
| `pnpm deploy` | Alchemy v2 deploy |
| `pnpm ingest` | Run `scripts/ingest.ts` under Bun |
| `pnpm lint` | Biome + Oxlint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest |

## Status

Scaffold in progress. Most of the Cloudflare bindings and tool wiring are stubbed -- search for `TODO:` and `MIGRATION-MARKER:` comments. See the project plan for sequencing.
