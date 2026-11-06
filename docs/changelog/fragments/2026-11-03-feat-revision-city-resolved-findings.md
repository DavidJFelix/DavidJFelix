### feat(revision.city): show resolved findings in the summary comment

Each run section of the summary comment now lists its findings above the collapsed details, and the
details no longer repeat them. A finding shows struck through and marked resolved when a user who
can push resolved every thread of that finding, also outdated threads. Its run cost still counts in
the total. Each edit of the comment, at the end of a run, shows the current state for the findings
of every run.
