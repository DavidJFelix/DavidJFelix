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

## Open questions

- Alchemy v2 + TanStack Start: first-party integration vs plain Worker fallback
- TanStack AI on Workers: isolated-vm caveats around server-fn tools
- Sandbox SDK as an Alchemy v2 resource vs wrangler-managed binding
- Chat transport on day one: default HTTP/SSE vs custom WS adapter for `useAgent`
- `alchemy dev` vs `wrangler dev` for the local loop

## Related

- [New Domain Sites](../new-domain-sites/plan.md) -- f311x.com row updated from SvelteKit to TanStack Start; this project supersedes that row
