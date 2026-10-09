### feat(revision.city): add the pull request review engine

First step toward revision.city reviewing pull requests as a GitHub App. The engine splits each
file's patch into chunks and asks three reviewers (security, correctness, comments) about each chunk
through OpenRouter. It maps the findings back to file lines, reports `medium` and above, and fails
on `high` and above. A store saves each chunk's answer under a hash of the model, reviewer prompt,
and chunk text. Once the GitHub App uses the D1 store, a re-run pays only for chunks that changed.
Lines are labeled inside the chunk, so an edit above a chunk does not invalidate its saved answer.
`mise run review -- owner/repo#123` prints the findings for a pull request; it keeps answers in
memory, so each run pays for every chunk. Nothing is wired to GitHub yet.
