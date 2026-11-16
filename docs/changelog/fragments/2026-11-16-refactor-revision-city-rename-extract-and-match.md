### refactor(revision.city): rename symbol extraction and matching from entity to symbol

`extract-entities.ts`, `match-entities.ts` and `entity-signature.ts` are now `extract-symbols.ts`,
`match-symbols.ts` and `symbol-signature.ts`, with their tests. `extractEntities` is
`extractSymbols`, `matchEntities` is `matchSymbols`, and the names, comments and test titles in
these files say symbol. The review tool that reads definitions uses the new names. This is the
second of five rename steps. The behavior does not change.
