### chore(f311x): update alchemy to 2.0.0-beta.67

alchemy moves from `2.0.0-beta.61` to `2.0.0-beta.67`, which lifts the effect cap that has held
since 2026-07: the cap existed because effect `beta.97` removed `Schedule.either`, which alchemy
`beta.61` still called in its state store and Cloudflare resources, and alchemy `beta.62` migrated
onto the new Schedule API. `beta.67` now requires effect `>= 4.0.0-beta.100`, so effect and
`@effect/platform-node` go to `4.0.0-beta.102` and the `@effect/platform-node-shared` override
follows them. The `@distilled.cloud/*` overrides move `0.28.2` -> `0.30.3` to match what `beta.67`
depends on by exact version -- alchemy pins them exactly, so a stale override silently holds the old
ones under the new alchemy rather than failing loudly.

`beta.66` reshaped the Worker `domain` prop from a flat hostname array into one canonical name plus
`aliases` and `redirects`, so f311x's prod ingress becomes
`{name: 'f311x.com', aliases: ['www.f311x.com']}`. `aliases` is the behavior-preserving translation:
both hostnames keep serving the Worker, where `redirects` would have 301'd `www` instead.
`workersDev` still defaults to enabled, so the prod smoke test's `*.workers.dev` target and the
per-PR preview URLs are unaffected. This breakage typechecks only under a config that includes
`alchemy.run.ts`, which the app tsconfig excludes -- it was caught by pointing tsc at the file
directly, and the exclusion remains a gap for the next bump.

A new `effect` override pins the whole workspace to one physical copy. Bumping f311x's effect alone
left a second one behind: `@standard-community/standard-{json,openapi}` (onvibes.org, via
`@flue/runtime`) take effect as an optional peer, and with the hoisted copy moved off `beta.94` bun
materialized `beta.94` nested for them instead of following the bump. Mixed effect copies are the
prime suspect for the SchemaAST TypeError chased on 2026-06-11, so the pin restores the single-copy
invariant a clean `bun install --frozen-lockfile` now confirms. Verified with f311x's typecheck, 42
unit tests, build, lint and format, `alchemy deploy` reaching the Cloudflare credentials step with
module load and schema construction both clear, plus onvibes.org's tests and build for the
shared-lockfile change.
