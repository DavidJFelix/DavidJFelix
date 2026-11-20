### refactor(revision.city): model the base-moved-on notice with XState Store

`useBaseMovedOn` keeps the compare status lookup in an XState Store, with the status `idle`,
`loading` or `answered`. Each request gets a new request id, and the store drops the answer to an
older request. This replaces the `cancelled` flag. A new request for the same path now hides the old
notice until its answer comes, and an answer with no notice clears it. Before, the old notice for
that path stayed.
