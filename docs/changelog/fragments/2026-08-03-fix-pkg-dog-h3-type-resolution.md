### fix(pkg.dog): typecheck the server routes against the h3 nitro actually bundles

`nuxt typecheck` failed on both server routes with
`'"h3"' has no exported member named 'toWebRequest'`, while the build, tests, smoke and e2e all
passed. The routes were right and the types were wrong: nitro `2.13.4` depends on `h3` `^1.15.11`
and bundles v1, which is where `toWebRequest` lives, but Nuxt's generated `.nuxt/tsconfig.json`
mapped the bare `h3` specifier to `h3@2.0.1-rc.20` instead. Renaming to v2's `toRequest`, as the
compiler suggested, would have typechecked and then broken the Sentry tunnel and the PostHog proxy
at runtime.

The v2 copy leaks in from another app. f311x's `@tanstack/start-server-core` depends on
`"h3-v2": "npm:h3@2.0.1-rc.20"`, and bun hoists an aliased package under its real name, so `h3`
became resolvable as v2 anywhere in the shared workspace -- one lockfile means one app's aliased
dependency can shadow another app's bare specifier. pkg.dog now declares `h3` `^1.15.11` directly.
It adds no physical copy (it dedupes onto the one nitro already resolves) and makes Nuxt generate
the mapping against v1, so types and runtime agree. The rationale is recorded in `bunfig.toml`
alongside the override pins, since a direct dependency that duplicates what `nuxt` already brings
otherwise reads as redundant.

This predates the alchemy update on this branch -- it reproduces on `060367e` with a clean install,
and the source is unchanged. It had been masked by a stale pre-`workspaces/` app tree left in the
session container, which is why the workspace check went green before that tree was removed. The
full check is now 64/64 on a clean `bun install --frozen-lockfile`, with pkg.dog's build output
still defining `toWebRequest`, its smoke passing, and its 5 e2e tests green.
