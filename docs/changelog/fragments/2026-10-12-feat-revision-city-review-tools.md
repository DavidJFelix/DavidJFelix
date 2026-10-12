### feat(revision.city): add tools that read the pull request head for a reviewer

Three tools read files from a snapshot of the pull request's head commit. `read_file` returns
numbered lines, at most 300 for each call. `list_directory` lists at most 200 entries of a
directory. `read_definition` returns a function, class, type, or other named item that
`extractEntities` finds. The tools refuse binary files and files over 1 MB. Each call that looks up
a path records the path and the Git object id at that path. If nothing is at the path, the id is
empty. The reviewers do not call the tools yet.
