# File Naming

All directory and file names in the repo MUST use lowercase kebab-case. This applies to source files
(`.ts`, `.tsx`, `.astro`), config files, docs, and scripts -- not just project documentation.

**Examples**: `vectorize-index.ts`, `chat-agent.ts`, `search-knowledge.ts`,
`2026-05-16-progress.md`, `vite.config.ts`.

**Components are not an exception.** A component's name comes from its export and the importer's
binding, not the filename, so PascalCase files buy nothing: `import {Button} from './button'` and
`import Analytics from './analytics.astro'` both work (the Astro case verified by building
`apps/davidjfelix.com` against a kebab-case component). Co-located tests follow the source name
(e.g. `button.test.tsx`).

## Exceptions (tool-mandated only; do not add without a demonstrated failure)

An exception exists only when a tool genuinely fails on the kebab-case name -- not because a
different casing is conventional in some ecosystem. Demonstrate the failure before documenting the
exception here.

- **TanStack Router file-based routes**: `__root.tsx`, `$.tsx`, and any other framework-mandated
  names.
- **Generated files**: e.g. `routeTree.gen.ts` from `@tanstack/router-plugin` -- leave as the tool
  emits them.
- **Ecosystem-standard meta files**: `README.md`, `LICENSE` (and the `LICENSE.md`, `LICENSE-MIT`,
  `LICENSE-APACHE`, `NOTICE.md` variants), `CONTRIBUTING.md`, `AGENTS.md`, `CLAUDE.md`,
  `CONTEXT-MAP.md`, `SKILL.md`, `Cargo.toml`, `Cargo.lock` -- names that tools and conventions
  mandate or expect; keep their casing.

When in doubt, prefer kebab-case.
