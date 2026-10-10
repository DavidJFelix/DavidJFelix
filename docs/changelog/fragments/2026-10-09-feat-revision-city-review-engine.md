### feat(revision.city): add the pull request review engine

First step toward revision.city reviewing pull requests as a GitHub App. The engine splits each
reviewable file's patch into chunks and asks three reviewers (security, correctness, comments) about
each chunk through OpenRouter. It maps the findings back to file lines, reports `medium` and above,
and fails on `high` and above or when a chunk review fails. A store saves each chunk's answer under
a hash of the model, reviewer, system prompt, and chunk text. Its D1 table is a drizzle schema, and
`mise run db:generate` writes the migrations. Once the GitHub App uses the D1 store, a re-run pays
only for chunks that changed or whose answer was not saved. Lines are labeled inside the chunk, so a
chunk that only moves in the file, for example after a rebase, keeps its saved answer.
`mise run review -- owner/repo#123` prints the findings for a pull request; it keeps answers in
memory, so each run pays for every chunk. Nothing posts to GitHub yet.
