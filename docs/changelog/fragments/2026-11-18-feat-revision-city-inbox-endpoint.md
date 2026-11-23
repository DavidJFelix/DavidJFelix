### feat(revision.city): add an inbox endpoint that gives every reason for a pull request

The new endpoint `/api/inbox` lists the open pull requests of the signed-in visitor as one flat
list. Each pull request comes one time, with all the reasons that it is in the inbox, in this order:
`review-requested`, `assigned`, `owned`, `member` and `watched`. Each pull request also has the
GitHub logins of its assignees. The newest update comes first. `isTruncated` is true when the list
can miss pull requests: a list of organizations or repositories was cut before its search, or GitHub
has more pull requests than a search gave.

The inbox item now names its logins `authorLogin` and `assigneeLogins`, and its `updatedAt` is a
`Date`. The JSON of the endpoint gives that time as an ISO 8601 string. `useInboxItems` makes items
of the same shape, gives `isTruncated` in place of `truncated`, and `formatRelativeTime` takes a
`Date`.

The reason `review-requested` comes from one more GitHub search, `review-requested:@me`. One inbox
load does at most 8 of the 30 searches that GitHub lets one user do in a minute. The inbox and the
pull request list share their searches and their answers for a signed-out visitor and for a failed
search. The pull request list does the same searches as before, and its pull requests now also have
their assignees. No page uses the new endpoint yet.
