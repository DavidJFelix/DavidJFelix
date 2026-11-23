### refactor(revision.city): model the view settings of the diff viewer with XState Store

The review UI keeps its seven view settings in one XState Store that lives as long as the review UI,
`src/diffs/state/view-settings-store.ts`. The settings are the split or unified view, the collapse
mode, word wrap, backgrounds, the indicator style, line numbers, and the file tree overlay on a
phone. The overlay has the states `closed`, `open` and `forced-closed`. A wide viewport forces it
closed, and after a change back to a phone viewport, the toggle opens it again. The header hides the
toggle button on a wide viewport, so a visitor sees no change. The patch loader reads the collapse
mode from the store, so the ref and the effect that copied it are gone. The store declares its
context and its nine events in `schemas` with `zod/mini`, and its types come from these schemas. The
store does not validate against the schemas.
