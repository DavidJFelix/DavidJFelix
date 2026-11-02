### fix(f311x): move alchemy to 2.0.0-beta.84 and its new provider packages

alchemy 2.0.0-beta.84 moved the Cloudflare and GitHub providers out of the `alchemy` package into
`@alchemy.run/cloudflare` and `@alchemy.run/github`. The Renovate alchemy bump did not add them, so
the f311x typecheck failed: `alchemy/Cloudflare` and `alchemy/GitHub` no longer resolve. f311x now
depends on both packages at 2.0.0-beta.84, and `alchemy.run.ts` and `github.ts` import from them.
The Renovate alchemy group now includes `@alchemy.run/**`, so these packages move with alchemy.

The same Renovate PR moved effect from 4.0.6 to 4.1.0. effect 4.1 removed the top-level
`effect/Crypto` module, but alchemy 2.0.0-beta.84 still imports it. Thus `alchemy deploy` cannot
load the f311x stacks on effect 4.1. tsc does not report this, because `skipLibCheck` hides the
missing module. effect and `@effect/platform-node` stay at 4.0.6. A new Renovate rule holds effect
and `@effect/**` below 4.1 until an alchemy release supports it.

`@alchemy.run/cloudflare` also depends on `@effect/sql-d1` `^4.0.5`, which resolved to 4.1.1. That
release needs effect `^4.1.1` as its peer. A new workspace override pins `@effect/sql-d1` at 4.0.6,
so the tree keeps one effect copy.
