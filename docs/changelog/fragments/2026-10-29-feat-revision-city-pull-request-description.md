### feat(revision.city): give the reviewers the pull request's title and description

Each chunk review now starts with the pull request's title and description (at most 4,000
characters), then the file list and the chunk. The description tells the reviewer what the author
wants the change to do, so fewer findings misread an intended change as a defect. The system prompt
tells the reviewer not to trust what the description says about the code. An edit to the title or
description makes each chunk review pay again on the next run. The `select files` step is now
`read pull request`, because its result has a new field.
