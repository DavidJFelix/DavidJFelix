# Spelling

<!-- The examples in this guide quote intentional non-words. -->
<!-- cSpell:ignore applicaiton falsey millis creds impls fqns wght -->

CSpell is the spell checker (root `.config/cspell.json`, run by `mise run spell`). Its value is
catching real typos, and every admission mechanism below weakens that check a little -- so each
unknown word gets the narrowest fix that still ties it to the source that needs it. Work down this
ladder and stop at the first rung that fits:

1. **Is it a typo?** Fix the spelling. This is the default assumption -- `falsey` becomes `falsy`,
   `applicaiton` becomes `application`. Don't reach for any mechanism below until you're sure the
   word is intentional.
2. **Is it a word you'd recognize globally** -- a real word the dictionaries lack, a domain term, a
   company, product, or person name (`burndown`, `posthog`, `workerd`, `higdon`)? Add it to `words`
   in `.config/cspell.json`. This is the only repo-wide list, so it holds nothing but words that
   stand on their own; anything you'd need the source file open to understand does not belong here.
3. **Is it an abbreviation?** Prefer the full word: `millis` becomes `milliseconds`, `creds` becomes
   `credentials`, `impls` becomes `implementations`. Established short forms (`ms`) are fine where
   the context expects them. Abbreviations do not go in the global dictionary.
4. **Is it a token required by a downstream system** -- a wire-format field name, a spec property, a
   file-name convention (`DTSTART` in iCalendar output, `millis` in Effect's Duration encoding,
   `wght` in fontsource file names)? Keep it next to its source: a `cSpell:words` comment in the
   file that speaks that protocol (`// cSpell:words fqns`, `<!-- cSpell:words NXDOMAIN -->`), or a
   local wordlist for that system when several files share it. If a cluster of flags is just
   compound words in one area, `cSpell:enableCompoundWords` scoped there beats listing them one by
   one.
5. **Is it an identifier that is _supposed_ to be nonsense** -- a TID, a UUID, a generated worker or
   branch suffix? `cSpell:ignore` the exact token on a comment beside its source. For a block dense
   with structured IDs, a tightly anchored `ignoreRegExpList` entry is acceptable (the
   `did:plc:[a-z0-9]+` entry is the model: the prefix guarantees it can never swallow prose). Never
   ignore anything that looks like a real word.

Treat every `cSpell:ignore` -- and especially every `ignoreRegExpList` entry -- as a dangerous
action: each one carves out text the checker will never see again. Keep ignores adjacent to the line
that needs them so they die when it does, and never use them to admit a real word; that is what
rungs 2-4 are for.

The global `words` list tracks need, not history: when a word's last use disappears (an ephemeral
project doc deleted, a feature removed), the entry comes out. To audit, empty `words` in
`.config/cspell.json` (working tree only, then restore) and run `mise run spell` -- every word the
repo still needs flags with its locations, and entries that flag nowhere are dead. The edit must be
made to the real config file: cspell merges discovered configs, so pointing `--config` at a copy
elsewhere silently re-admits everything the original allowed.
