### refactor(revision.city): model the theme cycle with XState Store

The theme cycle of the System Monitor keeps its status (`idle` or `cycling`), its step duration and
its current theme in an XState Store. A toggle gives the visible theme to the store, so the three
refs that copied the theme names and the resolved mode are gone. The store emits each step, and the
hook sets the theme. A toggle before the theme selection is hydrated now does not start the sweep.
Before, the sweep started from a light theme then. `themeCycleLogic` declares its context and its
three events in `schemas` with `zod/mini`, and the store gets its types from these schemas. The
store does not validate against the schemas, so its behavior does not change.
