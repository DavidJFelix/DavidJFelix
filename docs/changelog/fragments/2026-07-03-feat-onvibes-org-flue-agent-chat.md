### feat(onvibes-org): add a Flue agent chat interface

Added a real-time chat page (`/chat`): a React island streaming messages from an `assistant` agent
over HTTP. Flue now owns the deployed Cloudflare Worker and hosts Astro inside it — `src/app.ts`
(Hono) mounts the agent API at `/api` and forwards everything else to the prebuilt Astro worker. The
agent is a keyless faux echo (swap point for a real model documented in `src/agents/assistant.ts`),
backed by Durable Objects with SQLite storage. The build gained a worker phase (`flue build` plus an
assets-binding patch step), smoke now boots the real Flue worker and exercises the agent endpoint,
and PR previews deploy isolated per-PR workers with their own Durable Object state via new reusable
`preview-worker` actions (version uploads cannot carry DO migrations, and shared previews would
write into production's agent storage).
