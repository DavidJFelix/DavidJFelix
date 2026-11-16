### refactor(revision.city): rename the symbol diff route from entity to symbol

The Symbols tab now sends its batches to `/api/diffs/symbol-diff` in place of
`/api/diffs/entity-diff`. The route file, the client's default endpoint, the paths in the tests and
the generated route tree use the new path. This is the last of five rename steps. A tab that stays
open across the deploy gets a 404 from the Symbols tab until it reloads.
