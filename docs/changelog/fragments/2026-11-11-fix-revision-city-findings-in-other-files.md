### fix(revision.city): drop a finding about another file instead of posting it on a wrong line

On #997, the comments review of `posthog-proxy.test.ts` found a problem in the changelog fragment
and in `posthog-proxy.ts`, but it posted the comment on lines 4 and 5 of the test file. A chunk
review posts each finding on the file of its chunk. So when the model reported a problem in a file
that it read with its tools, the comment showed on an unrelated line of the chunk. Now each finding
names its file in a `path` field, and the prompt tells the reviewer to report only problems in the
file of its chunk. A finding whose `path` names another file is dropped before the verify pass, so
it is not checked or posted. The review of that other file still covers the problem. Saved answers
that have no `path` still post as before.
