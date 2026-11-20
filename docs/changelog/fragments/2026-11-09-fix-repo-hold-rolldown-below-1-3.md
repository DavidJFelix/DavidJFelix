### fix(repo): hold rolldown below 1.3 until vite accepts it

The bun patch/minor Renovate PR moved the root rolldown override from 1.2.16 to 1.3.0. vite 8.3.5
declares rolldown `~1.2.14`, but the override applies to vite too. With rolldown 1.3.0, the vite
production build writes a dynamic import with a leaked placeholder hash after
`__vite__mapDeps(...)`. The client entry chunk then fails with a SyntaxError. The apps did not
hydrate, and the Playwright suites of six apps that build with vite failed against their previews.
The astro apps passed. The build itself does not fail, so CI did not find the problem.

A new rule in `.github/renovate.json` holds rolldown below 1.3.0. Raise the bound when a vite
release declares rolldown 1.3.
