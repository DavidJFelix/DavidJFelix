# f311x.com

## Goal

Effect-native AI agent app on Cloudflare. TanStack Start front+back, Cloudflare Agents SDK for persistent agents, with Effect-TS owning async orchestration. Chat-driven: a user converses with an agent that has tools to act on the system (R2 files, Vectorize search, sandbox execution, durable multi-step plans).

## Stack

- **Runtime**: Cloudflare Workers (primary), Bun (scripts / local CLI)
- **Frontend + backend**: TanStack Start (Vite, file-based routing, server functions)
- **IaC**: Alchemy v2 (`v2.alchemy.run`) -- Effect-native, infra and runtime in one program
- **Agents**: `cloudflare/agents` (DO-backed `AIChatAgent`, scheduling)
- **AI calls**:
  - TanStack AI for in-app tools via `createServerFnTool` (primary tool surface)
  - Vercel AI SDK only where `AIChatAgent.onChatMessage` requires it
  - Both wrapped in Effect at the call boundary
- **Orchestration**: Effect-TS (typed errors, retries, timeouts, structured concurrency, cancellation). Not `@effect/ai` yet.
- **Model routing**: OpenRouter primary; Anthropic direct fallback via ExecutionPlan-style retry
- **CF primitives day one**: R2, Vectorize, Durable Objects (via Agents), Workflows, Dynamic Workflows, Sandboxes, AI Gateway
- **Agent state**: DO SQLite (built into Agents SDK)
- **Schemas**: Zod by default; convert to Effect Schema only at the runtime boundary if forced

## Repo layout

```
apps/f311x/
├── alchemy.run.ts              # Alchemy v2 stack -- infra + runtime as Effects
├── src/
│   ├── server.ts               # Worker entry -- routes Agents, TanStack Start, Workflows
│   ├── agents/
│   │   ├── chat-agent.ts       # AIChatAgent subclass
│   │   └── tools/              # createServerFnTool definitions
│   ├── effects/
│   │   ├── runtime.ts          # ManagedRuntime factory keyed on Env bindings
│   │   ├── layers.ts           # Infra layers: R2, Vectorize, KV, AI Gateway
│   │   └── services/           # Tags: ObjectStore, VectorStore, ModelClient, Sandbox, WorkflowDispatcher
│   ├── workflows/
│   │   ├── research.ts         # Static WorkflowEntrypoint
│   │   └── dynamic-plan.ts     # Dynamic Workflow loader for agent-authored plans
│   ├── routes/                 # TanStack Start routes
│   │   ├── __root.tsx
│   │   ├── index.tsx           # Chat UI
│   │   └── api/
│   └── lib/
│       ├── schemas.ts          # Zod schemas
│       └── env.ts              # Typed Env from Alchemy worker inference
├── scripts/
│   └── ingest.ts               # Runtime-agnostic Effect program example
├── package.json
├── tsconfig.json
├── vite.config.ts              # agents() + TanStack Start + react() + cloudflare()
└── AGENTS.md
```

## Phases

### Phase 1 — Read docs, then scaffold

- [ ] Read current docs for Alchemy v2 (v2.alchemy.run), Cloudflare Agents, Cloudflare Workflows + Dynamic Workflows, TanStack AI. Flag any contradictions with this plan -- doc page wins
- [ ] `bun create` a TanStack Start project into `apps/f311x`
- [ ] Add deps: `effect`, `agents`, `@tanstack/ai`, `@tanstack/ai-react`, `@tanstack/ai-openrouter`, `ai`, `@ai-sdk/openrouter`, `@ai-sdk/anthropic`, `zod`, `@cloudflare/vite-plugin`
- [ ] Dev deps: `wrangler`, `typescript`, agents Vite plugin
- [ ] tsconfig: extend `agents/tsconfig`; `target: ES2022`, `moduleResolution: Bundler`, `strict: true`; `@/` -> `src/`
- [ ] vite.config.ts plugin order: `agents()`, TanStack Start, `react()`, `cloudflare()`

### Phase 2 — Infra (Alchemy v2)

- [ ] `alchemy.run.ts` declares: R2 uploads bucket, R2 agent-workspace bucket, Vectorize index, AI Gateway binding, Worker Loader binding (Dynamic Workflows)
- [ ] Main Worker with bindings: R2 buckets, Vectorize, Agents DO namespace, static Workflow, Dynamic Workflow, Sandbox DO namespace, secrets (OPENROUTER_API_KEY, ANTHROPIC_API_KEY)
- [ ] Use Alchemy's TanStack Start integration if present; else plain Worker with `entrypoint: ./src/server.ts` and let Vite build
- [ ] Export typed `Env` from worker inference

### Phase 3 — Effect runtime + services

- [ ] `src/effects/runtime.ts`: `makeFetchRuntime(env)` factory -- builds per-request `ManagedRuntime` from env-derived live layers. `Effect.runPromise(program, { signal: request.signal })` for cancellation
- [ ] Service tags: `ObjectStore` (R2), `VectorStore` (Vectorize), `ModelClient` (OpenRouter + Anthropic fallback), `Sandbox`, `WorkflowDispatcher`
- [ ] Live layers per binding

### Phase 4 — Agent

- [ ] `src/agents/chat-agent.ts` extends `AIChatAgent<Env>`
- [ ] `onChatMessage`: build per-request runtime; Effect program loads Vectorize context, calls Vercel AI SDK `streamText`, `Effect.timeout` + `Effect.retry(exponentialJittered)`
- [ ] Tool bridge: `createServerFnTool` -> AI SDK `tool({...})` via thin helper (both speak Zod)
- [ ] Long-running tools dispatch to Workflows; agent `onWorkflowProgress` broadcasts updates

### Phase 5 — Tools (one definition shared by chat + server fns)

- [ ] `searchKnowledge` (Vectorize)
- [ ] `readFile` / `writeFile` (R2)
- [ ] `runCommand` (Sandbox)
- [ ] `scheduleResearch` (Workflow start)
- [ ] `generateAndDeployHandler` (Dynamic Workflow -- agent-authored code)

### Phase 6 — Workflows

- [ ] `src/workflows/research.ts` static `WorkflowEntrypoint`; each `step.do` runs an Effect; uses `step.sleep`, `step.waitForEvent`
- [ ] `src/workflows/dynamic-plan.ts` Worker Loader-backed; persist agent-authored TS `run(event, step)` plans to R2 keyed by agent + plan ID

### Phase 7 — Worker entry + chat UI

- [ ] `src/server.ts`: `routeAgentRequest(request, env)` first, TanStack Start handler fallback, request abort -> Effect cancellation bridge
- [ ] `src/routes/index.tsx` chat UI via TanStack AI React hooks; default HTTP transport pointed at a server fn that proxies to the agent (WS-via-Agents-SDK adapter is a follow-up)

### Phase 8 — Parity + dev loop

- [ ] `scripts/ingest.ts`: same service tags, different layer composition for Bun
- [ ] `bun run dev` runs locally with hot reload
- [ ] `alchemy deploy` (or v2 equivalent) provisions end-to-end

### Phase 9 — Make it actually work (functionality)

Most behavior is stubbed or unverified. Turn the scaffold into a working agent.

- [ ] Verify the Alchemy v2 CLI entry contract; finish wiring DO / Workflow /
      Vectorize bindings (currently `declare`-only stubs)
- [ ] Provision the Vectorize index and bind it; replace stub vector paths
- [ ] Implement `WorkflowDispatcher.startDynamicPlan` against the real Worker
      Loader binding (`DynamicPlanWorkflow.run`) — currently skeleton only
- [ ] Real Sandbox execution path verified end-to-end (not just compiling)
- [ ] Route OpenRouter through AI Gateway once the binding URL shape is confirmed
- [ ] Chat transport decision (HTTP/SSE vs WS via `useAgent`) and finish the UI
- [ ] Exercise each tool (`searchKnowledge`, `readFile`/`writeFile`,
      `runCommand`, `scheduleResearch`, `generateAndDeployHandler`) against live
      bindings — the bodies exist but are unverified

### Phase 10 — Continuous delivery

Deploy must be automated, not a manual `pnpm deploy` from a laptop.

- [ ] `cd_deploy_f311x.yml` GitHub Actions workflow, path-filtered to `apps/f311x/`,
      following the repo's CD style guide (`docs/github-actions-style.md`) and the
      existing `cd_deploy_*` workflows
- [ ] Deploy via Alchemy v2 (or `wrangler deploy` until the v2 CLI contract is
      confirmed) on push to the default branch
- [ ] Cloudflare auth via repo secrets (account ID + API token), no persisted creds
- [ ] Provision/confirm out-of-band resources (Vectorize index, secrets) so the
      automated deploy is reproducible — file human-intervention issues for anything
      needing the dashboard/credentials
- [ ] First successful automated deploy to a real Cloudflare account is the
      done-bar for this phase

## Constraints

- Effect owns async. No naked `fetch`/`await` outside service implementations
- Zod by default; Effect Schema only at the boundary if a service demands it
- One model abstraction per call site (Vercel AI SDK inside `onChatMessage`; TanStack AI everywhere else)
- Tool defs live only in `src/agents/tools/*.ts`
- Every `Effect.runPromise` carries the upstream `AbortSignal`
- No premature `@effect/ai`; leave a marker comment at each model-call site
- Pre-1.0 SDKs (Alchemy v2, Dynamic Workflows, TanStack AI): keep the Effect service layer thin enough that an SDK swap is layer-level

## Done definition (scaffold)

- `bun run dev` brings up app locally with hot reload
- `/` shows chat UI; messages stream from an agent DO
- A built-in tool (e.g. `searchKnowledge`) is callable from chat and from a React component as a server fn -- one shared definition
- `alchemy deploy` provisions everything end-to-end
- One static Workflow (research) and one Dynamic Workflow path wired (stubs OK)
- A Bun script demonstrates runtime-agnostic Effect code calling the same services with different layers

## Status (2026-06-03)

⚠️ **Regression — see [2026-06-03 progress](./2026-06-03-progress.md) and #202.**
The runtime layer was deleted across `3613624` and `c9f2353` (the latter mislabeled
"fix: run biome"): `src/server.ts`, `src/effects/**`, `src/workflows/**`,
`src/lib/schemas.ts`, and `src/alchemy/vectorize/**` are gone, but `chat-agent.ts`
+ `agents/tools/**` still import them. As committed, f311x **does not typecheck or
build**, and the chat agent is not deployed (`alchemy.run.ts` ships only the Vite
site + R2 ×2 + AI Gateway). The 2026-05-29 "typecheck + build pass" status below is
**no longer accurate**. Repair is tracked in #202; the direction (restore vs. strip)
is an open decision, and the Phase 9 issues are blocked on it.

## Status (2026-05-29)

Scaffold milestone is hit (typecheck + build pass, chat UI + tools/embeddings/
workflows/sandbox wired) but **the app is not functional** — most surfaces are
stubs or unverified against a real Cloudflare account. The remaining work is
tracked as **Phase 9 (functionality)** and **Phase 10 (continuous delivery)** in
the Phases section above.

## Open questions

- Alchemy v2 + TanStack Start: first-party integration vs plain Worker fallback
- TanStack AI on Workers: isolated-vm caveats around server-fn tools
- Sandbox SDK as an Alchemy v2 resource vs wrangler-managed binding
- Chat transport on day one: default HTTP/SSE vs custom WS adapter for `useAgent`
- `alchemy dev` vs `wrangler dev` for the local loop

## Related

- [New Domain Sites](../new-domain-sites/plan.md) -- f311x.com row updated from SvelteKit to TanStack Start; this project supersedes that row

## Agent self-hosting (folded in from Setup Hermes / Setup OpenClaw)

The standalone **Setup Hermes** and **Setup OpenClaw** projects were dropped
(2026-05-29) — David is no longer setting up those two products. The underlying
intent (self-hosting an AI agent that's reachable securely from anywhere) lives
here, since f311x is the agent-hosting effort. Carried-over thinking to revisit
when f311x deployment matures:

- **Hosting**: f311x's answer is Cloudflare (Workers + Agents DO). The earlier
  research had also weighed home server/NAS, VPS (Hetzner/Fly/Railway), and a
  dedicated cloud VM — keep as fallbacks if a long-running runtime is ever needed
  beyond what Workers/Containers provide.
- **Secure remote access**: Tailscale was the plan for the self-hosted variants
  (host vs. sidecar/subnet router, Funnel/Serve vs. tailnet-only, ACLs/tags,
  MagicDNS). Not needed for the Cloudflare deployment, but relevant if any piece
  ever runs off-Cloudflare.
- **Providers / gateways**: same shortlist f311x already adopts — OpenRouter
  (multi-model routing), Cloudflare AI Gateway (caching/limits/observability),
  direct provider APIs (Anthropic fallback), plus sandboxed execution (Daytona /
  Vercel Sandboxes were candidates; f311x uses Cloudflare Sandbox).
