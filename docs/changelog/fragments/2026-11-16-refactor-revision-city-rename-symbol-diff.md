### refactor(revision.city): rename the symbol diff from entity to symbol

`diff-entities.ts` and its test are now `diff-symbols.ts` and `diff-symbols.test.ts`. `diffEntities`
is `diffSymbols`, and `EntityChange`, `EntityChangeType`, `EntityDiff` and `EntityDiffSummary` are
`SymbolChange`, `SymbolChangeType`, `SymbolDiff` and `SymbolDiffSummary`. The coverage gate names
the new file. The comments in these files say symbol. This is the third of five rename steps. The
behavior does not change.
