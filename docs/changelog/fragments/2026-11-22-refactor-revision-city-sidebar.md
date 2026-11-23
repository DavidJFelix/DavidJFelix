### refactor(revision.city): model the diff viewer sidebar with XState Store

The sidebar of the diff viewer keeps its state in an XState Store, one store for each sidebar. The
state is the active tab, the open status panel and the Git status filter of the file tree. The store
status (`symbolsUnopened` or `symbolsOpened`) records the first open of the Symbols tab, which lets
the symbol reads start. In `symbolsUnopened` the Symbols tab cannot be the active tab. The
`symbolsRequested` state beside the tab is gone, and so are the other three `useState` calls of the
sidebar state. `sidebarLogic` declares its context and its five events in `schemas` with `zod/mini`,
and the store gets its types from these schemas. The store does not validate against the schemas, so
its behavior does not change.
