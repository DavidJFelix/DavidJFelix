### feat(revision.city): add the filter logic of the inbox

The inbox gets the pure functions behind its filters, with no UI yet. `filterInboxItems` keeps the
pull requests that pass a query and the filters by repository, author, assignee, reason and draft
state. `listInboxFilterOptions` lists the repositories, authors, assignees and reasons in the inbox,
with the number of pull requests for each value. `inboxSearchSchema`, `readInboxFilters` and
`writeInboxSearch` keep the filters in the page address, with one short key for each filter that is
set. A wrong value in the address reads as not set. The coverage gate now includes `src/inbox/lib/`.
