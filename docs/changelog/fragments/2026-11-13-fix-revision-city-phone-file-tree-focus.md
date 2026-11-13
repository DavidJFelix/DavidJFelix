### fix(revision.city): keep the closed phone file tree out of the focus order

On a phone, the closed file tree now has `visibility: hidden` after its slide ends, so Tab and
screen readers do not reach it. The open tree is a modal dialog: focus moves into it, Escape closes
it, focus goes back to the toggle, and the header and the diff behind it are `inert`. The desktop
sidebar does not change.
