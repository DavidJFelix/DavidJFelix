### refactor(revision.city): rename the symbol diff client, endpoint and hook from entity to symbol

`entity-diff-client.ts`, `entity-diff-endpoint.ts` and `use-entity-diffs.ts` are now
`symbol-diff-client.ts`, `symbol-diff-endpoint.ts` and `use-symbol-diffs.ts`, with their tests.
`streamEntityDiffs`, `handleEntityDiffRequest`, `useEntityDiffs`, `EntityDiffRequest`,
`EntityDiffEntry` and the other names in them say symbol, and so do their uses in the diffs sidebar,
the review page and the Symbols tab test. The route path does not change yet. This is the fourth of
five rename steps. The behavior does not change.
