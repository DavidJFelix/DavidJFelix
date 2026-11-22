### refactor(revision.city): model the comment draft of the diff viewer with XState Store

`DiffsViewer` keeps its comment draft and its line selection in a store in
`src/diffs/state/draft-comment-store.ts`. The store is `idle` or `drafting`, and the open draft has
a file, a key, and a line range. The key counter, the ref of the open draft, and the selection state
are gone. The rules that the callbacks applied by hand are now in the transition table, with tests:
a new draft on another file discards the open draft, a removal closes the draft when it is the open
one, and a save of blank text or of a draft that is not open changes nothing. The viewer items keep
the comments, so the store emits each change and the viewer applies it. `draftCommentLogic` declares
its context, events, and emitted events in `schemas` with `zod/mini`. What a visitor sees does not
change.
