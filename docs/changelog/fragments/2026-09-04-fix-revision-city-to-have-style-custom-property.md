### fix(revision.city): assert the theme custom property with the string form of toHaveStyle

`@davidjfelix/revision.city#typecheck` has been failing on main whenever turbo actually ran it
instead of replaying a cached pass, so any PR that busted the cache (a `.config/mise.toml` change,
for one) went red on the web-apps turbo job. The onvibes.org rewrite added
`@vitest/browser-playwright` next to vitest in the workspace lockfile, which pulls
`@vitest/browser/jest-dom.d.ts` into the program. That file augments vitest's `Assertion` with
`toHaveStyle(css: string | Partial<CSSStyleDeclaration>)`, and a CSS custom property is an excess
property against `CSSStyleDeclaration`; the `@testing-library/jest-dom` typing it displaced accepted
any record. The one affected assertion in `react-overrides.test.tsx` now passes the declaration as a
string, which both typings accept and which jest-dom parses identically.
