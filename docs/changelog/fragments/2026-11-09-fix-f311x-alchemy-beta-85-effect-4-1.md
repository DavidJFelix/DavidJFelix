### fix(f311x): update alchemy to 2.0.0-beta.85 with effect 4.1.2

alchemy 2.0.0-beta.85 imports `effect/crypto/Digest`, which is only in effect 4.1. The Renovate PR
moved alchemy alone, because a Renovate rule held effect below 4.1 for beta.84. On effect 4.0.7,
`alchemy deploy` failed with `ERR_MODULE_NOT_FOUND` before it loaded the stack. This change moves
alchemy, its provider packages, and effect with its `@effect` packages together, and removes the
effect hold.
