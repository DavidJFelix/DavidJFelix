### feat(revision.city): track symbols on public diffs without signing in

The symbols tab no longer demands a GitHub session. A public repo reads fine unauthenticated, which
is how the viewer already loads its patch -- `wrangler.toml` states the intent plainly: without
GitHub App credentials "the viewer stays public-only". The endpoint had required sign-in only
because it was modelled on the file-expansion endpoint, which is stricter than this needed to be. A
session still earns its keep: it is what makes private repos work and what raises the rate limit.

The empty states changed with it. There is no longer a "sign in to track symbols" wall; the tab now
explains itself only where it genuinely cannot help -- on the alternate-domain sources, which are
not GitHub -- and when a read fails it shows GitHub's own message instead of a blank panel. That
message is the useful one: it distinguishes an unreachable repo from an exhausted anonymous rate
limit, and says signing in raises the latter.

`loadGitHubDiffFiles` grew an explicit `tokenSource: 'anonymous'`, which never falls back to the
server token in `DIFFSHUB_GITHUB_TOKEN`. That variable is unset on the deployed worker today (it is
a leftover of the diffshub port), so the fallback is currently dead -- but a security boundary
should not rest on a variable happening to be unset. Configuring one later would otherwise hand
every unauthenticated visitor that token's reach and land private content in a cache every visitor
shares. Two paired tests pin this: an anonymous read sends no `Authorization` header even with the
variable set, and a default read does send it, so the first test cannot pass vacuously.

Verified by unit and Playwright specs, including a signed-out visitor getting a populated panel and
a failed read surfacing its reason. Live anonymous access to github.com could not be exercised from
the development sandbox, whose proxy mediates all GitHub traffic; the per-PR preview deploy is where
that path runs for real.
