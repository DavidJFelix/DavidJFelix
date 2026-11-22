### refactor(revision.city): declare the symbol diffs store's context and events with schemas

`symbolDiffsLogic` now declares its context and its eight events in `schemas`, with `zod/mini`. The
types `SymbolDiffsContext`, `SymbolDiffsInput`, `SymbolDiffEntry` and `SymbolDiffStatus` are now
inferred from schemas. They keep their names, their `readonly` and optional fields, and the `status`
union, so the callers do not change. The handlers lose their inline payload types. The `trigger`
that the batch effect gets is now typed by the event schemas, so an event with a wrong payload is a
type error. The store does not validate against the schemas, so its behavior does not change.
