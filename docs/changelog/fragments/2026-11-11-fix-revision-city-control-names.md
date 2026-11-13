### fix(revision.city): name the URL field, comment box, submit button and sidebar tabs

Screen readers now hear a name for the diff URL field ("Diff URL"), the comment box ("Comment") and
the icon-only comment submit button ("Submit"). The sidebar tabs and the header menu button groups
now tell which item is selected. A saved comment is now read as its author and message. While the
"Please enter a valid URL" popover shows, a scroll event no longer renders the URL form again if the
field did not move. Nothing changes on screen. Vitest now transforms `@pierre/icons`, so unit tests
can load components that use its icons.
