# onvibes.org

Onvibes is an **agent**. The website is how you reach it. (The earlier "showcase + builder
toolchain" framing is dead -- see [CONTEXT.md](../../../apps/onvibes.org/CONTEXT.md).)

## Status

**Early build** (2026-07-06). Live at onvibes.org with the landing layout and a `/chat` page backed
by a Flue agent in the deployed Worker (faux echo until a real model is wired). The auth design is
decided (below); building it is the current work, and it gates the real-model swap.

## Auth (decided 2026-07-06)

Anyone can sign up; nobody can do anything until manually enabled.

- **Sign-up / sign-in via GitHub OAuth**, hand-written flow -- no auth library. `better-auth` and
  `next-auth` are banned repo-wide
  ([tooling-standard.md](../../contributing/tooling-standard.md)); any other auth library needs
  explicit sign-off.
- **Users and sessions in D1**, schema managed by **Drizzle**. Session id in an HttpOnly cookie.
- **`enabled` boolean on the user row, default false.** Enablement is a manual database flip
  (`wrangler d1 execute`). Disabled users get an error -- no request-access machinery. What
  eventually replaces the manual flip (billing, admin panel) is deliberately undecided.

## Current state (2026-07-02)

- Live at onvibes.org (custom domain + www wired; `preview_urls` on). The deployed Worker is
  **Flue hosting Astro**: `src/app.ts` mounts the Flue agent API at `/api` and forwards everything
  else to the prebuilt Astro worker (see PR #303 and the 2026-07-02 progress note).
- `/` renders the header/hero/footer layout; `/chat` is a React island talking to a keyless faux
  echo agent (`src/agents/assistant.ts`).
- Smoke boots the Flue worker, checks `/` + `/chat`, and POSTs the agent endpoint; Playwright e2e
  boots the same worker. Local dev: `astro dev` proxies `/api` to `flue dev` (port 3583).

## Stack

Astro + PandaCSS + React islands, Flue (agents on Durable Objects), Cloudflare Worker, D1 +
Drizzle.

## Roadmap

- [ ] Auth as decided above: GitHub OAuth, D1 + Drizzle users/sessions, `enabled` flag.
- [ ] Swap the faux echo for a real model, gated on `enabled`.

## Related

- App: [`apps/onvibes.org`](../../../apps/onvibes.org/)
- Domain language: [`apps/onvibes.org/CONTEXT.md`](../../../apps/onvibes.org/CONTEXT.md)
- Cross-cutting: [Sentry](../sentry-integration/plan.md), [PostHog](../posthog-integration/plan.md)
