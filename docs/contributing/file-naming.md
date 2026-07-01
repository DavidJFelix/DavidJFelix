# File Naming

All directory and file names in the repo MUST use lowercase kebab-case. This applies to source
files (`.ts`, `.tsx`, `.astro`), config files, docs, and scripts -- not just project documentation.

**Examples**: `vectorize-index.ts`, `chat-agent.ts`, `search-knowledge.ts`,
`2026-05-16-progress.md`, `vite.config.ts`.

## Exceptions (framework- or convention-imposed; do not change without intent)

- **React / Astro components**: `Header.tsx`, `BaseLayout.astro`, `ThemeToggle.tsx` -- PascalCase
  matches the component identifier and is the established convention in both ecosystems. Co-located
  tests follow the source name (e.g. `BaseLayout.test.ts`).
- **TanStack Router file-based routes**: `__root.tsx` and any other framework-mandated names.
- **Generated files**: e.g. `routeTree.gen.ts` from `@tanstack/router-plugin` -- leave as the tool
  emits them.
- **Ecosystem-standard meta files**: `README.md`, `LICENSE`, `CONTRIBUTING.md`, `AGENTS.md`,
  `CLAUDE.md`, `CONTEXT-MAP.md`, `SKILL.md`, `Cargo.toml` -- names that tools and conventions
  mandate or expect; keep their casing.

When in doubt, prefer kebab-case. If a third-party tool requires a different casing, treat that as
the exception and document it here.
