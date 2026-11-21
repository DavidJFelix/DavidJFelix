### refactor(revision.city): model the diff URL form with XState Store

The diff URL form keeps its URL and its status (`editing`, `invalid` or `submitting`) in an XState
Store. The Enter key sets `submitting` until the submit event, so the blur that Enter can cause does
not restore the committed URL. This status replaces the `isSubmittingRef` flag and the validation
error state. Before, only a submit cleared the flag. Now typing, Escape and the clear button also
end `submitting`, so a later blur on an empty field restores the committed URL again.
`diffUrlFormLogic` declares its context and its six events in `schemas` with `zod/mini`, and the
store gets its types from these schemas. The store does not validate against the schemas, so its
behavior does not change.
