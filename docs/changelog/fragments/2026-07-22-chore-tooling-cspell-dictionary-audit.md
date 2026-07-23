### chore(tooling): audit the cspell dictionary down to words the repo still needs

<!-- The list below quotes intentional non-words. -->
<!-- cSpell:ignore creds impls vulns millis typesafety -->

Audited the cspell dictionary by emptying its `words` list and re-running the spell task to map
every remaining flag to its source: 234 entries in, 156 out. The 48 entries that flagged nowhere
(covered by cspell's bundled dictionaries or orphaned by deleted docs) were dropped. Structured
identifiers -- ATProto TID record keys, Cloudflare Worker name suffixes, a branch slug, a Workers AI
model id -- moved to `cSpell:ignore` comments beside their source, quoting the full identifier and
saying what it is. System vocabularies shared across files moved to named topic dictionaries under
`.config/dictionaries/` (iCalendar property names, DNS response codes, people names); one-file
tokens (Effect's `millis` duration field, OpenType axis tags) became per-file `cSpell:words`
comments. Abbreviations (`creds`, `impls`, `vulns`) were spelled out in prose, and `typesafety` was
a real fix the dictionary had been papering over. The repo's preferred `falsey` spelling is now
enforced the other way: its conventional variant sits in `flagWords`, so cspell rejects it with the
replacement.

The config itself moved from `.config/cspell.json` to `.config/cspell.jsonc` (a
lint-format-loose-ends task) and is now sectioned and commented so every entry can say why it
exists; per-app calendar-visualizer followed, and the CI path filters track the rename. The decision
ladder -- typo, global word, abbreviation, system token, nonsense identifier -- is documented in
`docs/contributing/spelling.md`, indexed from `CONTRIBUTING.md` and the `AGENTS.md` hard rules.
