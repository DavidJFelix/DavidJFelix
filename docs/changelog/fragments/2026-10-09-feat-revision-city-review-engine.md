### feat(revision.city): add the pull request review engine

First step toward revision.city reviewing pull requests as a GitHub App. The engine splits each
file's patch into chunks, asks three reviewers (security, correctness, comments) about each chunk
through OpenRouter, maps the findings back to file lines, and decides the outcome: findings of
`medium` and above are reported and `high` and above fail. Each chunk's answer is saved under a hash
of the model, reviewer prompt, and chunk text, so a re-run pays only for chunks that changed; lines
are labeled inside the chunk, so an edit above a chunk does not invalidate its saved answer.
`mise run review -- owner/repo#123` prints the findings for a pull request. Nothing is wired to
GitHub yet.
