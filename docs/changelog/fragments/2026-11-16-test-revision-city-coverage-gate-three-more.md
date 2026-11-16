### test(revision.city): hold three more viewer modules to the coverage gate

The coverage gate now also names `constants.ts`, `github-auth.ts` and `gutter-detector.ts` in
`src/diffs/lib`. New tests cover the first batch size for each viewport height, the gutter probe and
its cache, and the sign-in paths that had no test: missing credentials at the callback, a failed or
unreadable user lookup, and an expired session with no refresh token. The thresholds do not change.
