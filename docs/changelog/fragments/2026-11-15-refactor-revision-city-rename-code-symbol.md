### refactor(revision.city): rename the core symbol types from entity to symbol

The Symbols core module `entity.ts` is now `code-symbol.ts`. `CodeEntity` is `CodeSymbol`, and
`EntityKind`, `EntitySpec`, `EntitySpan`, `EntityRange`, `entityProp` and `ResolveEntityNameParams`
now say symbol, to match the glossary. The comments in the module and in the language tables use the
same word. This is the first of five rename steps. The behavior does not change.
