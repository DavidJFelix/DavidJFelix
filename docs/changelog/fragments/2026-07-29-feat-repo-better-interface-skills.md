### feat(repo): vendor the better-\* interface skills

Seven interface skills from Jakub Krehel's
[skills collection](https://github.com/jakubkrehel/skills) now live in `.agents/skills/` with the
usual `.claude/skills/` symlinks: `better-interface` (the user-invoked cross-discipline review that
coordinates the rest), `better-accessibility`, `better-layout`, `better-writing`,
`better-typography`, `better-colors`, and `better-ui`. Each skill owns one interface domain, fires
from context during UI work, and adapts to whatever styling system the app already uses instead of
imposing one.

The vendored folders came in under MIT and are offered under the repository's MIT OR Apache-2.0 dual
license, with the retained copyright and permission notice in `.agents/skills/NOTICE.md`;
`LICENSE.md` records the origin, and `skills-lock.json` pins the folder hashes, so the copies are
read-only and improvements go upstream. A new
[interface-style.md](../../contributing/interface-style.md) mini guide records the domain-ownership
table and how to invoke `/better-interface`; CONTRIBUTING.md, the AGENTS.md hard rules, and the
`design-reviewer` persona now point at it.
