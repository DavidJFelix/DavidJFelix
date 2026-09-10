# monicandavid.com (Monica & David)

A couple's blog for Monica & David — their shared corner of the web.

## Status

**Placeholder — basic layout shipped** (2026-06-19). Live at monicandavid.com; SvelteKit and
PandaCSS. The landing now reads as a couple's blog; the actual posts are the next phase.

## Vision

A shared, low-key personal blog for Monica & David as a couple — writing about their life together.
Small and personal by design: not a wedding/event site, not a business. When the real blog is built,
mirror djf.io's content approach (a content collection of markdown posts), adapted to SvelteKit.

## Current state (2026-09-10)

- Live at monicandavid.com (SvelteKit on Cloudflare; custom domain + www wired).
- `src/routes/+page.svelte` is a real basic landing — header, an "Our blog" hero, footer (Panda
  `css()`). Copy reads as a couple's blog ("Posts coming soon"). No posts yet.
- Accounts groundwork: a Drizzle schema for D1 (`users`, `authentications`) with migrations in
  `drizzle/`, an HS256 session-token contract (`src/lib/server/session.ts`), and `/admin` gated by
  the `session` cookie in `src/hooks.server.ts`. No sign-in flow yet; the D1 binding waits on the
  database being created (see the commented block in `wrangler.toml`).

## Stack

SvelteKit and PandaCSS, Cloudflare Worker. Drizzle over Cloudflare D1 for data; sessions are a
three-claim JWT (`sub`, `iat`, `exp`) signed with the `SESSION_SECRET` wrangler secret.

## Roadmap

### Phase 1 — Basic layout

- [x] Confirm the site's purpose with David. (2026-06-19 — a couple's blog)
- [x] Replace the single `<h1>` with a real layout: header, hero, footer. (done 2026-06-19)

### Phase 2 — Blog

- [ ] Set up posts: a content collection of markdown posts (mirror djf.io, adapted to SvelteKit).
- [ ] A post list (home or `/blog`) and individual post pages.
- [ ] RSS / basic metadata once there's something to syndicate.

### Phase 3 — Accounts (sign in with Google, no passwords)

- [x] D1 schema: `users` and `authentications`, prefixed UUID v7 ids, first migration. (2026-09-10)
- [x] Session contract: HS256 JWT with `sub` / `iat` / `exp`; `/admin` refuses requests without a
      valid `session` cookie; vitest + Playwright coverage. (2026-09-10)
- [ ] Human: create the D1 database, bind it in `wrangler.toml`, apply the migration, set the
      `SESSION_SECRET` secret.
- [ ] Google OpenID Connect sign-in: callback upserts the authentication (and the user on first
      sign-in), signs a session, sets the cookie; the hook redirects to it instead of 401.

## Related

- App: [`apps/monicandavid.com`](../../../apps/monicandavid.com/)
- Content approach to mirror: [djf.io](../djf-io/plan.md).
- Cross-cutting: Sentry + PostHog observability are live fleet-wide (projects closed 2026-07-30; see
  the [changelog](../../changelog/)).
