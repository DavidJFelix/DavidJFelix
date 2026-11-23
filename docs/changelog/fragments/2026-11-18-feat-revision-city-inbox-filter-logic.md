### feat(revision.city): add the filter logic of the inbox

The inbox gets the pure functions behind its filters, with no UI yet. `filterInboxItems` keeps the
pull requests that pass a query and the filters by repository, author, assignee, reason and draft
state. `listInboxFilterOptions` lists the repositories, authors, assignees and reasons in the inbox,
with the number of pull requests for each value, and `countActiveInboxFilters` counts the filters
that are set. The coverage gate now includes `src/inbox/lib/`.
