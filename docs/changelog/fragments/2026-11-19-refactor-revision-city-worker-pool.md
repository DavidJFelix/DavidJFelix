### refactor(revision.city): model the worker pool state and its recovery with XState Store

The state of the diffs worker pool now lives in one XState store for the page,
`src/diffs/state/worker-pool-store.ts`, with the states `initializing`, `ready`, `failed`, and
`recovering`. The store refuses a second worker load failure, so a page still gets one recovery. A
restart of the pool now has a time limit of 15 s. After it, the viewer shows the state that the pool
reports; before, a restart that did not settle kept the viewer waiting. The review UI and the System
Monitor read the pool state and stats from the store. The module variables, the listener set, and
the React state that copied the pool stats are gone.
