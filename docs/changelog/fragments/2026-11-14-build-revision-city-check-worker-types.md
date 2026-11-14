### build(revision.city): check the committed worker types at typecheck

The app's typecheck now fails when the committed `worker-configuration.d.ts` is stale: it runs
`wrangler types --check` before `tsc`. A new `mise run types` task regenerates the file after a
wrangler bump or a `wrangler.toml` change. Both commands ignore a local `.dev.vars`, so a laptop and
CI make the same file. The file is regenerated here for the pinned wrangler, which moves the runtime
types to a newer workerd.
