### chore(tooling): audit the cspell dictionary down to words the repo still needs

<!-- The list below quotes intentional non-words. -->
<!-- cSpell:ignore creds impls vulns falsey millis typesafety -->

Audited `.config/cspell.json` by emptying its `words` list and re-running the spell task to map
every remaining flag to its source: 234 entries in, 157 out. The 48 entries that flagged nowhere
(covered by cspell's bundled dictionaries or orphaned by deleted docs) were dropped. Structured
identifiers -- ATProto TID record keys, Cloudflare Worker name suffixes, a branch slug -- moved to
`cSpell:ignore` comments beside their source, and downstream-system tokens -- iCalendar property
names, Effect's `millis` duration field, OpenType axis tags, DNS response codes -- moved to per-file
`cSpell:words` comments, so both die with the files that need them. Abbreviations (`creds`, `impls`,
`vulns`) were spelled out in prose, and `falsey`/`typesafety` turned out to be real spelling fixes
the dictionary had been papering over. The decision ladder -- typo, global word, abbreviation,
system token, nonsense identifier -- is now documented in `docs/contributing/spelling.md`, indexed
from `CONTRIBUTING.md` and the `AGENTS.md` hard rules.
