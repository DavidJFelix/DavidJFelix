### feat(revision.city): diff viewer ported from Pierre's diffshub under /diffs

Ports the diffshub app from the PierreJS monorepo into `apps/revision.city` as a feature tree
(`src/diffs/`) mounted at `/diffs`. The viewer renders any public GitHub diff -- PRs, compares,
commits, `.diff`/`.patch` URLs, plus Tangled patch URLs via a `domain` query param -- with
virtualized rendering, worker-pool syntax highlighting (Shiki in bundled web workers), streaming
patch loading, a themed Shiki chrome (theme catalog, light/dark/system), local draft comments
with neutral initial-letter personas, a file tree sidebar, and an optional GitHub token (stored in
localStorage, forwarded per-request) for private repos and file expansion.

The Next.js surface became TanStack Start: the two API route handlers moved to server routes
(`/diffs/api/diff`, a validating streaming proxy with authenticated fallbacks, and
`/diffs/api/github-diff-file` for context expansion), the catch-all page became the `/diffs/$`
splat route with canonicalizing redirects in `beforeLoad`, `next/link`/`next/navigation` became
TanStack Router APIs, `next/font` became Fontsource (Geist Variable; JetBrains Mono Variable
replaces the non-redistributable Berkeley Mono), and the worker moved to Vite `?worker` bundling.
Styling was rewritten from Tailwind 4 to Panda CSS: semantic tokens/radii/fonts under a `diffs`
namespace bound to the ported CSS variable theme in `src/diffs/diffs.css` (loaded only on /diffs
routes), Panda `cva` recipes for Button/Input, and specificity-scoped overrides where the old
tailwind-merge behavior was load-bearing. Pierre branding was neutralized: no DiffsHub name/logo,
no Pierre socials or brand assets or team avatar photos, no `diffshub-*`/`DiffsHub*` identifiers
(now `diffs-*`/`Diffs*`), and the pierrecdn demo-blob cache was dropped in favor of fetching
examples straight from GitHub. `@pierre/diffs`, `@pierre/trees`, `@pierre/theme`, `@pierre/theming`,
and `@pierre/icons` are consumed as published npm packages at the versions diffshub pinned.

Nine diffshub test files came along, converted from `bun:test` describe blocks to flat co-located
vitest tests (`test.each` tables where cases were parallel), with URL expectations updated for the
`/diffs` prefix. The smoke gate now probes `/diffs` alongside `/`, and the landing page's Diffs
card links to the new viewer.
