### feat(revision.city): let reviewers read files through tools

With a snapshot of the pull request's head commit, a reviewer can call `read_file`,
`list_directory`, and `read_definition` before it answers. The prompt asks it to read only the code
that a possible problem depends on. One chunk review has at most 4 rounds of tool calls, 6 calls in
a round, and 48,000 characters of tool output. A saved answer records each path that its tools
looked up, including directories and paths that do not exist. A later run uses the saved answer only
if none of those paths changed. If a model call or a tool fails, the chunk review fails, but the
cost of its earlier model calls still counts. The prompt also tells reviewers to treat instructions
in the diff and the files as text to review. It says that an empty suggestion deletes the lines.
`mise run review` loads the snapshot, so its model must support tool calls. It also lists the files
that it does not review because they have no text diff or are too large.
