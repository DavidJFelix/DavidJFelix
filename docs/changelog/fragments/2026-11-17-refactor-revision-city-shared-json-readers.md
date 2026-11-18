### refactor(revision.city): share the small JSON readers

A new `src/lib/json-read.ts` holds `isRecord`, `readOptionalString`, `readOptionalNumber`,
`readStringPath` and `readUnknownPath`. The fourteen copies of `isRecord` in the viewer, the Symbols
code and two client hooks, and the copies of the other four readers, are deleted and imported from
it. Every copy had the same behavior, so nothing changes at run time.
