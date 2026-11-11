### fix(revision.city): keep the newest run when the summary comment is full

When the summary comment got longer than GitHub accepts, the app cut the end of the text. Then the
newest run lost findings, or the comment did not show it, and the run count and the total cost
stopped at the old values. Now a cut removes text from the oldest runs first: the details of each
run, then the findings of each older run, then each older run. The newest run loses findings only
when it alone is too long for the comment. A hidden line in the header holds the number and the cost
of the removed runs, so the header still counts each run and its cost. A finding title with a
Unicode line or paragraph separator now stays on one line, so the summary comment reads it back as a
finding.
