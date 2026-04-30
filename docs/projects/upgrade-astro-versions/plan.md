# Upgrade Astro Versions

## Goal

Upgrade [djf.io](../../../apps/djf.io) from Astro 5 to Astro 6.

## Scope

- Bump `astro` from `^5.18.1` to the latest 6.x in [apps/djf.io/package.json](../../../apps/djf.io/package.json).
- Bump official integrations as needed for Astro 6 compatibility: `@astrojs/mdx`, `@astrojs/react`, `@astrojs/rss`, `@astrojs/check`.
- Address any breaking changes from the Astro 5 → 6 migration guide.
- Verify build, tests (Vitest + Playwright), and Cloudflare Workers deploy still pass.

## Out of scope

- Other apps in the repo (only djf.io is on Astro today).
- Non-Astro dependency upgrades — handled separately under [Dependency Freshness](../dependency-freshness/plan.md).

## Phases

1. **Read the migration guide** and note any breaking changes that touch this codebase.
2. **Bump versions** and run `pnpm install`.
3. **Fix breakage** until typecheck, lint, build, and tests pass locally.
4. **Verify deploy** to Cloudflare Workers preview before merging.
