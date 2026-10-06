### chore(tooling): track the web-apps catalog in Renovate and catch it up

Renovate's bun manager does not read bun catalogs. The shared dev tooling moved into the web-apps
`workspaces.catalog` in September, and after that Renovate stopped updating it. The Dependency
Dashboard listed only four dependencies for the workspace manifest: `bun`, `rolldown`, and the two
`effect` overrides. The catalog moved only when a Claude session fixed a broken Renovate PR by hand.
By early October, 23 of the 27 entries were behind.

A JSONata custom manager in `.github/renovate.json` now reads each catalog entry as an npm
dependency. The existing group rules and the three-day release age apply to these entries. The
custom manager changes only `package.json`. A packageRule therefore refreshes `bun.lock` after each
catalog update with `bun install --cwd workspaces/web-apps --lockfile-only --ignore-scripts`.
Renovate installs bun 1.4.2 for this command through `installTools`. `RENOVATE_ALLOWED_COMMANDS` in
the Renovate workflow allows the command, because that option is only for self-hosted Renovate. When
a Renovate release reads bun catalogs (renovatebot/renovate#42909), delete the manager, its
packageRule, and the allowlist.

The catalog also moves to the newest same-major release that is at least three days old:

- wrangler 4.147.0, `@cloudflare/vite-plugin` 1.62.5, and `@cloudflare/workers-types` 5.20261002.1;
  wrangler and the vite plugin share one workerd copy again
- the TanStack router and start set, on `@tanstack/react-router` 1.170.41
- Playwright 1.63.0, jsdom 30.1.1, and `@testing-library/dom` 10.4.2
- `@types/node` 26.6.4, `@types/bun` 1.4.2, and the React types 19.3.0
- `oxlint-tailwindcss` 1.14.0 and Panda 1.12.1

The vitest 5 and Panda 2 majors stay out of this change. Renovate now opens their PRs.
