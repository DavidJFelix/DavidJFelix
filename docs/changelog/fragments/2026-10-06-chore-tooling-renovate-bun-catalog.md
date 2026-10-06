### chore(tooling): track the web-apps catalog in Renovate and catch it up

Renovate's bun manager does not read bun catalogs, so after the shared dev tooling moved into the
web-apps `workspaces.catalog` in September, Renovate stopped updating it: the Dependency Dashboard
listed only `bun`, `rolldown`, and the two `effect` overrides for the workspace manifest, and the
catalog moved only when a Claude session fixed a broken Renovate PR by hand. By early October, 23 of
the 27 entries were behind.

`.github/renovate.json` now has a JSONata custom manager that reads every catalog entry as an npm
dependency, so the existing group rules (cloudflare, tanstack, oxc, the vitest monorepo, the
three-day release age) apply to the catalog. The custom manager writes only `package.json`, so a
packageRule runs `bun install --cwd workspaces/web-apps --lockfile-only --ignore-scripts` after each
catalog update, on bun 1.4.2 installed through Renovate's `installTools`. The command is allowlisted
by `RENOVATE_ALLOWED_COMMANDS` in the Renovate workflow, since that option is self-hosted-only.
Delete the manager, its packageRule, and the allowlist once a Renovate release extracts bun catalogs
(renovatebot/renovate#42909).

The catalog also caught up to the newest same-major release that is at least three days old:
wrangler 4.147.0 with `@cloudflare/vite-plugin` 1.62.5 (one shared workerd copy again) and
`@cloudflare/workers-types` 5.20261002.1, the TanStack router and start set on
`@tanstack/react-router` 1.170.41, Playwright 1.63.0, `@types/node` 26.6.4, the React types 19.3.0,
`@types/bun` 1.4.2, jsdom 30.1.1, `oxlint-tailwindcss` 1.14.0, Panda 1.12.1, and
`@testing-library/dom` 10.4.2. The vitest 5 and Panda 2 majors are left for the PRs Renovate now
opens.
