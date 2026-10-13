### fix(revision.city): bind the review database by its id

The `DB` binding now names the `revision-city` D1 database by its id. Without the id,
`wrangler deploy` must find or create the database itself. The deploy token has no D1 permission for
that, so each production deploy since #810 stopped with an error.
