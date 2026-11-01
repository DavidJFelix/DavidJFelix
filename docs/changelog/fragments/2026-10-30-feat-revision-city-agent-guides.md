### feat(revision.city): give the reviewers the repository's agent guides

The system prompt of each chunk review now has the root `AGENTS.md` and the `AGENTS.md` nearest to
the chunk's file, at most 12,000 characters each. When the guides of a pull request pass 50,000
characters in all, the folder guides after that limit are left out. The guides are read at the base
commit, so a pull request cannot change the rules that review it. A pull request whose base is not
the default branch gets no guides. The prompt tells each reviewer to report a break of a written
rule only when the rule clearly applies to the changed lines and is in its area, and to read a
linked document when a finding depends on it. A change to a guide on the base branch makes the chunk
reviews under it pay again. The `read pull request` step is now `read pull request and guides`,
because its result has a new field.
