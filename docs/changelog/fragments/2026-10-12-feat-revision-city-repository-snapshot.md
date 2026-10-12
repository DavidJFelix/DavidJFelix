### feat(revision.city): load a snapshot of a commit's file tree

`loadRepositorySnapshot` reads the recursive Git tree of one commit from GitHub. It reads a blob
when a caller first asks for it, and keeps the blob for later calls. After a failed read, the next
call tries again. When GitHub truncates the tree, it returns nothing, because then a missing path
does not prove that a file does not exist. `readsStillMatch` tells whether files that were read from
one snapshot are unchanged in a newer one. The reviewers do not use the snapshot yet; a later change
gives them tools that read files from it.
