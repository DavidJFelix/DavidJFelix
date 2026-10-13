### feat(revision.city): review chunks in batches and scope saved results

`reviewPullRequest` now has three parts that a Workflow can call one batch at a time.
`planChunkReviews` lists the chunk reviews, `reviewChunks` runs a batch of them, and
`summarizeChunkReviews` adds up the outcomes. When a chunk review fails because a call failed, its
outcome says whether a new attempt can succeed. After an OpenRouter error that is not temporary,
such as a bad key, a new attempt cannot succeed. Each saved chunk review now has a scope, such as
one GitHub App installation. Thus a saved result never shows that another installation reviewed the
same code. `mise run review` uses the scope `local`.
