# Add ghalint & pinact

## Goal

Adopt [ghalint](https://github.com/suzuki-shunsuke/ghalint) and [pinact](https://github.com/suzuki-shunsuke/pinact) to lint and pin GitHub Actions across the repo.

## Rationale

- **ghalint** catches common GitHub Actions anti-patterns (missing permissions, unpinned actions, deprecated syntax)
- **pinact** rewrites action references from mutable tags to immutable full-length commit SHAs, preventing supply-chain attacks via tag re-pointing
- Together they enforce a security-first, lint-clean CI configuration

## Implementation

### Phase 1: Install via mise

- Add `ghalint` and `pinact` to `.config/mise.toml`
- Verify both tools run against existing workflows

### Phase 2: Fix existing workflows

- Run `pinact run` to pin all action references to SHAs
- Run `ghalint run` and fix any reported issues
- Commit fixes

### Phase 3: CI enforcement

- Add a CI step (or pre-commit hook) that runs `ghalint run` and `pinact run --verify` so unpinned or non-compliant actions fail the build

## Files

- `.config/mise.toml` - tool versions
- `.github/workflows/*.yml` - all workflow files
