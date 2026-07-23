### fix(alchemy-state-viewer): reset the document title when navigating back to the stacks page

The default `alchemy state` title lived in the root layout's `<svelte:head>`, but layouts persist
across client-side navigation, so their head content only applies when the layout first mounts. The
stack and resource pages set their own titles, and navigating back to the stacks page -- which had
no title of its own -- left the subpage title stuck in the tab. Title ownership moves to the pages:
the stacks page now sets the default title, the error page sets `{status} - alchemy state`, and the
layout sets none.
