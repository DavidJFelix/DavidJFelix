# GitHub Actions Hygiene (ghalint, pinact, zizmor, actionlint)

## Goal

Adopt four GitHub Actions tools to enforce a lint-clean, security-first CI configuration across the repo:

- [actionlint](https://github.com/rhysd/actionlint) — workflow correctness (syntax, expressions, shellcheck inside `run:`)
- [ghalint](https://github.com/suzuki-shunsuke/ghalint) — Actions anti-patterns and policy (missing `permissions:`, dangerous defaults)
- [zizmor](https://github.com/woodruffw/zizmor) — Actions security audit (template injection via `${{ github.event.* }}`, `pull_request_target` + PR-ref checkout, cache poisoning, artifact leaks)
- [pinact](https://github.com/suzuki-shunsuke/pinact) — rewrite action references to immutable full-length commit SHAs

## Rationale

- The four tools have non-overlapping coverage: correctness (actionlint), policy/lint (ghalint), security audit (zizmor), and supply-chain pinning (pinact).
- Workflows currently use floating major tags (`@v4`, `@v2`, `@v3`) and most lack top-level `permissions:` declarations — class-of-bug findings these tools catch.
- Pinning to SHAs prevents tag re-pointing supply-chain attacks; static audits prevent injection-style attacks against runners.
- Install + run + enforce flow is the same shape for all four, so bundling avoids re-doing the CI plumbing later.

## Implementation

### Phase 1: Install via mise

- Add `actionlint`, `ghalint`, `zizmor`, `pinact` to `.config/mise.toml`.
- Verify all four run against existing workflows.

### Phase 2: Fix existing workflows

- Run `pinact run` to pin all action references to SHAs.
- Run `actionlint` and fix correctness issues.
- Run `ghalint run` and fix policy issues (add top-level `permissions:`, etc.).
- Run `zizmor` and fix security findings.
- Commit fixes.

### Phase 3: CI enforcement

- Add a workflow that runs all four tools on PR and push to `main`.
- Treat `actionlint`, `ghalint run`, `zizmor`, and `pinact run --verify` failures as build failures.
- Optionally wire the same checks as pre-commit hooks.

## Files

- `.config/mise.toml` — tool versions
- `.github/workflows/*.yml` — all existing workflow files
- `.github/workflows/actions-lint.yml` (new) — CI enforcement
