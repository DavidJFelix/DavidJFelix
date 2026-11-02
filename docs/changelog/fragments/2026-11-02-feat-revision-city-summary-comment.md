### feat(revision.city): keep one summary comment on each pull request

Each review now adds a section to one Revision City comment on the pull request, and edits that
comment in place. A section shows the commit, the findings, and the cost table of its run. The top
of the comment shows the number of runs and their total cost. When the comment gets too long for
GitHub, the oldest runs lose their details first and keep their heading and cost. A failed comment
update only logs a warning and does not fail the review. Each section holds the id of its check run,
so a retry after a lost response does not add the run again.
