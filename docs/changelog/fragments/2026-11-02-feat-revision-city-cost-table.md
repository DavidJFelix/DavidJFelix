### feat(revision.city): show the cost of each chunk review in a table

The "Cost per chunk review" section of the check run is now a table with columns for cost, chunk,
reviewer, prompt tokens, and completion tokens. A total row is the first row, so that a cut of a
long list keeps it. Token counts have thousands separators.
