### fix(f311x): move alchemy to 2.0.0-beta.80 with effect 4.0.0

effect 4.0.0-rc.118 moved every `effect/unstable/*` module to a top-level path (for example
`effect/unstable/http` became `effect/http`). The Renovate alchemy group moved effect to rc.118 but
kept alchemy at 2.0.0-beta.79, which still imports `effect/unstable/cli/Command`, so the f311x
preview deploy failed with `ERR_MODULE_NOT_FOUND` before the CLI started. alchemy 2.0.0-beta.80 uses
the new paths and requires effect `^4.0.0`, so f311x and the workspace overrides now pin alchemy
2.0.0-beta.80, effect 4.0.0, and `@effect/platform-node` 4.0.0.
