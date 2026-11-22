### refactor(revision.city): model the base-moved-on notice with XState Store

`useBaseMovedOn` keeps the compare status lookup in an XState Store, with the status `idle`,
`loading` or `answered`. Each request gets a new request id, and the store drops the answer to an
older request. This replaces the `cancelled` flag. A new request for the same path now hides the old
notice until its answer comes, and an answer with no notice clears it. Before, the old notice for
that path stayed. The store declares its context and its events in `schemas`, with `zod/mini`, and
its types come from these schemas. The store does not validate against the schemas, so they do not
change its behavior.
