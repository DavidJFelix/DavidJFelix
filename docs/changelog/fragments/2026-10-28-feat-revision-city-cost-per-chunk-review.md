### feat(revision.city): show the cost of each chunk review in the check run

The `Revision City` check run gave only the total cost of a review. Now its text ends with a
`Cost per chunk review` section: one line for each chunk review (one reviewer prompt on one chunk),
with the file, the reviewer, the cost in US dollars, and the prompt and completion tokens. A chunk
review that used a saved result shows `saved result` at $0. A file with more than one chunk shows
the part number of each chunk. The most expensive chunk reviews go first, and the section is last,
so a cut for the check run size limit removes the cheapest ones first. The cost of a chunk review is
the sum of all its tool loop rounds.
