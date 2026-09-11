### feat(monicandavid.com): session-gated /admin route and the D1 user schema

Groundwork for signing in with Google, ahead of the sign-in flow itself. The app gains Drizzle
(`drizzle-orm` at runtime, `drizzle-kit` for migrations) with a SQLite schema for Cloudflare D1 in
`src/lib/server/db/schema.ts`: a `users` table (`id`, `full_name`) and an `authentications` table
(`id`, `provider`, `provider_id`, `user_id`) that records each way a user can prove who they are.
`provider` is constrained to the supported identity providers (`google` for now), `provider_id` is
the provider's stable subject id (Google's `sub` claim, never the email), and the provider pair is
unique so one identity maps to one user. Row ids are a type prefix and a UUID v7 in Crockford base32
(`user_...`, `authn_...`), so they sort by creation time as plain strings; `mise run db:generate`
writes migrations into `drizzle/`, and the first one is committed. The D1 binding itself stays
commented out in `wrangler.toml` until the database exists in the account, because `wrangler deploy`
refuses a binding to a database it cannot find; the block carries the two steps to turn it on.

Sessions are an HS256 JWT with exactly three claims (`sub`, `iat`, `exp`), signed with the
`SESSION_SECRET` wrangler secret through `jose`. A new `hooks.server.ts` refuses every request under
`/admin` unless the `session` cookie carries a token whose signature matches, whose issued-at time
has passed, and whose expiry has not; the route itself is an empty page whose server load keeps
client-side navigation on the server path. Vitest covers the token contract (wrong secret, edited
claims, expired, future-dated, unsigned, wrong algorithm, missing claims) and Playwright the HTTP
behavior, minting cookies against a throwaway secret the local `wrangler dev` boot is given.

Previews no longer touch the production worker. The first preview of this change failed its own
suite: a cookie that is not a token drew a 500, because the production worker had no
`SESSION_SECRET` and the hook reports a missing key as a misconfiguration. Rather than hand CI the
production signing key so the suite could mint sessions, `wrangler.toml` gains an `[env.dev]` worker
(`monicandavid-com-dev`, workers.dev only, no custom domains) with its own throwaway secret, and the
app registers `devEnv: 'dev'` in `bin/plan-affected-apps.ts`, so previews upload as versions of the
dev worker and main deploys it alongside production, the way revision.city already works. Two
pipeline gaps closed on the way: the preview upload and the production deploy now pass a dev entry's
environment to wrangler as `--env`, which an app deploying straight from its `wrangler.toml` needs
to reach `[env.dev]` at all (a build that resolved the environment into a redirected config passes
wrangler's match check), and the preview action takes an `e2e-session-secret` input that reaches the
suite as `E2E_SESSION_SECRET`. The workflow feeds it the Depot secret
`E2E_SESSION_SECRET_MONICANDAVID_COM` for that app alone, gated by name rather than a `format()`
lookup, which zizmor rejects as handing the job every secret. The signed cases skip until that
secret and the dev worker's `SESSION_SECRET` are set to the same value.

Vitest browser mode also arrives, the Svelte counterpart of onvibes.org's setup:
`vitest-browser-svelte` with the Playwright provider renders `*.svelte.test.ts` component tests in
Chromium, starting with the theme toggle's light, dark, system cycle.
