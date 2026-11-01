### feat(revision.city): log why a model call stopped and where its tokens went

Chunk reviews on DeepSeek V4.1 Flash still stop at the 32,000 output token cap, and the `model call`
events could not tell a model that repeats itself from a model that reasons for a long time. Each
event now has the finish reason, the reasoning tokens, the reasoning and answer lengths, the
provider, the reviewer, the file and size of the chunk, the run and round of the tool loop, the tool
choice, and the token cap and reasoning effort that the request sent. A reply that the cap cut also
keeps the last 2,000 characters of its reasoning.
