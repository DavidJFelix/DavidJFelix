### chore(revision.city): regenerate the worker types

`worker-configuration.d.ts` now comes from wrangler 4.149.0, the version in the catalog. The
wrangler updates did not regenerate it, so it had the runtime types of workerd 1.20260903.1. It now
has those of workerd 1.20261006.1. The bindings do not change.
