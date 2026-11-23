### refactor(revision.city): keep the saved comments of the diff viewer in an XState store

The sidebar list of saved comments, grouped by file, is now a store in
`src/diffs/state/saved-comments-store.ts`, and `usePatchLoader` creates it. The hook returns the
store in place of `setCommentSections`, and `ReviewUIInner` sends it a `commentSaved` or a
`commentDeleted` event. A comment on a file that the file list does not have, or a delete of a
comment that the list does not have, now changes nothing. Before, each one made a new copy of the
list and a new render. The list clears when a load starts, in the load effect, because a render must
not send events to a store. `savedCommentsLogic` declares its context and events in `schemas` with
`zod/mini`.
