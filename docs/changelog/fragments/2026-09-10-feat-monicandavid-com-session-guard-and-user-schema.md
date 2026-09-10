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
behavior, minting cookies against a throwaway secret the local `wrangler dev` boot is given. Against
a deployed preview the signed cases skip unless `E2E_SESSION_SECRET` is supplied.

Vitest browser mode also arrives, the Svelte counterpart of onvibes.org's setup:
`vitest-browser-svelte` with the Playwright provider renders `*.svelte.test.ts` component tests in
Chromium, starting with the theme toggle's light, dark, system cycle.
