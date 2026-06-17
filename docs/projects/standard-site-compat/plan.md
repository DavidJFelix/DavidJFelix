# djf.io standard.site Compatibility

## Goal

Make `apps/djf.io` compatible with [standard.site](https://standard.site) — an opt-in
interoperability standard for **long-form publishing on the AT Protocol** (the network
behind Bluesky). It defines shared lexicons — `site.standard.publication` (a blog/site)
and `site.standard.document` (a post) — plus a domain-verification handshake, so AT
Protocol clients and aggregators can discover, index, and cross-reference a site's
content. The payoff: djf.io becomes a first-class citizen in the Bluesky/ATProto
long-form ecosystem.

It is **not** a generic web standard (unrelated to microformats, JSON Feed, RSS). The
site already has strong SEO/feed foundations (RSS, sitemap, OG, JSON-LD); this adds the
ATProto layer on top.

## Context

David already owns the identity: his Bluesky handle is **`@djf.io`**, on **bsky.social**
(no self-hosted PDS). Records live in that account's repo under its `did:plc:…`. He chose
**CI-integrated sync on deploy** to keep records in step with posts.

## What compatibility requires

Two halves:

- **AT Protocol records** (live on bsky.social, created with an app password — never in the repo):
  - One `site.standard.publication` record. Required: `url`, `name`. Optional: `description`, `icon`, `preferences.showInDiscover`.
  - One `site.standard.document` per post. Required: `site` (publication AT-URI), `title`, `publishedAt` (ISO 8601). Optional: `path`, `description`, `tags`, `textContent`.
- **Website artifacts** (this repo):
  - `/.well-known/site.standard.publication` returning the publication AT-URI as **plain text** (e.g. `at://did:plc:XXXX/site.standard.publication/self`). No specific Content-Type required.
  - `<link rel="site.standard.document" href="at://…/site.standard.document/<rkey>" />` in each post's `<head>` (required — confirms page↔record).
  - `<link rel="site.standard.publication" href="at://…/site.standard.publication/self" />` site-wide (optional discovery hint).

## Architecture

### Deterministic AT-URIs — the load-bearing decision

Use **stable record keys** so every AT-URI is computable from one committed DID constant:

- Publication rkey = `self` (singleton convention, cf. `app.bsky.actor.profile`).
- Document rkey = the post slug = `post.id` (e.g. `2025-12-07-on-running`). Slugs are
  lowercase-kebab filenames and already valid AT rkeys (charset `a-zA-Z0-9.-_:~`, ≤512
  chars); a small `documentRkey()` validates and throws on anything out of charset.

So `at://<DID>/site.standard.document/<slug>` is fully determined by DID + slug — **the
static build computes the same URIs the sync script writes**, with no PDS round-trip and
nothing persisted back into the repo. This is what makes CI-integrated sync clean: the
deploy step only ensures the records *exist*; it never edits the repo (no bot commits, no
generated map that can drift).

`post.id` is the existing join key (URLs, OG image paths `/og/blog/${post.id}.png`,
sitemap, RSS `link`) — no new identifier, and `content.config.ts` frontmatter is
untouched.

### Shared source of truth — `apps/djf.io/src/lib/standard-site.ts`

A **pure** module (no `astro:` imports, so the bun sync script can import it too):

- `ATPROTO_DID` — the `did:plc:…` for `@djf.io` (public; committed constant).
- `PUBLICATION_RKEY = 'self'`; `documentRkey(postId)`; `publicationUri()`; `documentUri(postId)`.
- Publication metadata constants (`name`, `description`, `url`) so site and sync agree.

Imported by all four consumers below → one place to change identity/metadata.

### `.well-known` endpoint — Astro endpoint, static-file fallback

Primary: `src/pages/.well-known/site.standard.publication.ts`, a `GET()` returning
`publicationUri()` as `text/plain; charset=utf-8` — mirrors the existing
`src/pages/rss.xml.ts` (`GET(context)`) and `src/pages/og/[...slug].png.ts`
(`new Response(body, {headers})`) endpoint shape. Astro prerenders it into `dist/`;
Wrangler `[assets]` serves it like `/rss.xml`.

Caveat to verify: Astro/Vite may exclude a leading-dot directory under `src/pages/`. If
so, fall back to a `public/.well-known/site.standard.publication` static file — the
content is a stable constant either way, so the fallback is zero-maintenance.

### `<link>` tags — reuse the existing head slot

- `src/layouts/BlogPost.astro`: beside the existing JSON-LD `slot="head"` injection
  (line 34), add `<link rel="site.standard.document" href={documentUri(post.id)} slot="head" />`.
  `BaseLayout.astro` already exposes `<slot name="head" />` (line 56) — same proven
  mechanism, no `<head>` restructuring.
- `src/layouts/BaseLayout.astro`: add the optional
  `<link rel="site.standard.publication" href={publicationUri()} />` next to the
  RSS/sitemap `<link>`s (lines 49–55).

### Sync tooling — `apps/djf.io/bin/sync-standard-site.ts` (bun)

First script in a new `apps/djf.io/bin/` dir (mirrors other apps' bun `bin/*.ts`, e.g.
forzamonica's `bin/smoke-local.ts`):

1. Auth: `@atproto/api` `AtpAgent`, `login({ identifier: 'djf.io', password: env.ATPROTO_APP_PASSWORD })` against `https://bsky.social`.
2. Safety: assert `agent.session.did === ATPROTO_DID` (catches wrong account / typo'd DID before writing).
3. Read posts directly from `src/content/blog/*.md` (bun fs + `gray-matter`; `astro:content` isn't available outside the Astro build). Slug = filename = `post.id`.
4. Idempotent upserts via `com.atproto.repo.putRecord` (create-or-update by rkey), using the **same** helpers the site uses:
   - publication at rkey `self` (`url`, `name`, `description`, `preferences.showInDiscover`),
   - one document per post at rkey = slug (`site`, `title`, `publishedAt`, `path: /blog/<slug>/`, `description`, `tags`).
5. Writes **nothing** back to the repo.
6. Wired as `[tasks."sync-standard-site"] run = "bun bin/sync-standard-site.ts"` in
   `apps/djf.io/mise.toml`; `@atproto/api` + `gray-matter` added to `apps/djf.io`
   devDependencies.

### CI integration (chosen: sync on deploy)

In `.github/workflows/cd-deploy-djf-io.yml`, add a step **after `astro build`, before
`wrangler deploy`**, gating the deploy on sync success (HTML never goes live referencing
records that don't exist):

```yaml
- name: sync standard.site records
  run: mise run sync-standard-site
  env:
    ATPROTO_APP_PASSWORD: ${{ secrets.ATPROTO_APP_PASSWORD }}
```

Idempotent, so safe on every djf.io deploy. The DID is public and committed; the **only**
secret is the app password.

**Security note (the tradeoff of this choice):** the app password grants full write to
David's ATProto repo. Mitigations: store as an encrypted GitHub Actions secret (never
committed); revocable/rotatable from Bluesky settings; the `session.did` assertion blocks
writes to the wrong account. Acceptable given the explicit CI-integration choice; revisit
if blast radius becomes a concern.

### Out of scope

`site.standard.graph.subscription`, `site.standard.graph.recommend`, and
`site.standard.theme` — these model reader-side relationships and client theming, authored
by readers'/clients' repos, not by a publisher describing its own content. No website
artifact or record we'd author.

### Defaults (low-stakes, adjustable in the shared module / sync script)

- Publication `name`: "David J. Felix's Blog"; `description`: "Thoughts on software,
  running, and life" (reuse RSS strings); `url`: `https://djf.io`.
- `preferences.showInDiscover`: `true` (public blog).
- `icon`: deferred (optional; needs a ≥256px square — later one-off export of headshot/favicon).
- `textContent` on documents: deferred — the website carries canonical content and `path`
  links to it.

## Phases

### Phase 1 — Plan & human-task issue (done 2026-06-17)

- [x] Research standard.site spec + audit djf.io; design the architecture
- [x] Project docs (this plan + progress)
- [x] Human-intervention issue filed for `@DavidJFelix` (DID + app password + GH secret)

### Phase 2 — Website implementation (no credentials needed)

- [ ] `src/lib/standard-site.ts` (DID constant + rkey/URI helpers + publication metadata)
- [ ] `src/pages/.well-known/site.standard.publication.ts` endpoint (static-file fallback if dot-dir excluded)
- [ ] `<link>` tags in `BlogPost.astro` + `BaseLayout.astro`
- [ ] Unit tests (`src/lib/standard-site.test.ts`) + e2e (`_site.standard.publication.e2e.test.ts`, post `<link>` assertion)
- [ ] `bin/sync-standard-site.ts` + mise task + deps (`@atproto/api`, `gray-matter`)
- [ ] CI sync step in `cd-deploy-djf-io.yml`

> Phase 2 lands `ATPROTO_DID` as a placeholder until Phase 3 supplies the real value;
> the `{… && …}` guards keep the build green and tag-free until then.

### Phase 3 — Go live (human + verify)

- [ ] David: confirm DID, create app password, add `ATPROTO_APP_PASSWORD` secret (issue)
- [ ] Deploy → sync step creates records
- [ ] Validate at [site-validator.fly.dev](https://site-validator.fly.dev/)

## Files

**Create**: `src/lib/standard-site.ts`; `src/pages/.well-known/site.standard.publication.ts`
(or `public/.well-known/...` fallback); `bin/sync-standard-site.ts`;
`src/lib/standard-site.test.ts`; `src/pages/.well-known/_site.standard.publication.e2e.test.ts`
(`_`-prefixed per the `src/pages/` rule, mirrors `_rss.xml.e2e.test.ts`).

**Edit**: `src/layouts/BlogPost.astro`; `src/layouts/BaseLayout.astro`;
`src/pages/blog/_[...slug].e2e.test.ts`; `apps/djf.io/mise.toml`;
`apps/djf.io/package.json`; `.github/workflows/cd-deploy-djf-io.yml`. No change to
`content.config.ts`, `astro.config.mjs`, `wrangler.toml`, or post Markdown.

## Verification

- **No credentials (deterministic URIs ⇒ fully CI-testable)**: unit tests for
  `documentRkey()`/URI builders; e2e asserting `/.well-known/site.standard.publication`
  is `200` with a body starting `at://` equal to `publicationUri()`, and a post `<head>`
  carries the `site.standard.document` `<link>`; `mise run build` + the Playwright suite.
- **Needs credentials (post-deploy)**: deploy runs the sync step → records exist;
  `curl https://djf.io/.well-known/site.standard.publication` returns the AT-URI; the
  standard.site validator resolves publication + document records end-to-end.

## Links

- App: [`apps/djf.io`](../../../apps/djf.io/)
- Spec: [standard.site/docs](https://standard.site/docs/) · Validator: [site-validator.fly.dev](https://site-validator.fly.dev/)
- [blog-style-improvement](../blog-style-improvement/plan.md) — sibling djf.io project
- Reuse references: `src/pages/rss.xml.ts` (endpoint shape), `BlogPost.astro` head slot,
  forzamonica's `bin/smoke-local.ts` (bun script + mise task pattern)
