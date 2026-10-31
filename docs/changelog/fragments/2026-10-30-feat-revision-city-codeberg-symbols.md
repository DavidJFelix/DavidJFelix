### feat(revision.city): show symbol changes on Codeberg diffs

The symbols tab now works on Codeberg pull requests and commits. The client sends the diff's
`domain` to `/api/diffs/entity-diff`. For `codeberg.org`, the route reads both revisions of each
file from the Codeberg API with no credentials, and looks up the pull request or commit once for
each batch of files. The route answers 400 for a Codeberg compare and for any other domain. The
empty state of the tab now names what it can read: GitHub diffs, and Codeberg pull requests and
commits.
