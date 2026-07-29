### feat(revision.city): list your open pull requests on the diffs home

Signing in with GitHub used to change nothing about the `/diffs` home page itself -- the session
only mattered once a visitor typed a URL. Signed-in visitors now get their open pull requests listed
right on the page, each one a click into the viewer, grouped by why they can see them and in that
priority order: assigned to them, in repositories they own, in repositories they are a member of,
and in repositories they watch. A pull request that qualifies for more than one group appears once,
under the first group that claims it; draft pull requests carry a small badge, and a group whose
GitHub-side count exceeds the rows shown says so ("5 of 12").

A new worker route, `/api/diffs/pull-requests`, assembles the list from the session cookie's token
-- the client never sees the token, matching the other auth routes. Assigned and owned come from one
GitHub search each (`assignee:@me`, `user:@me`); membership asks `/user/orgs` and searches those
organizations; watching asks `/user/subscriptions` and searches the watched repositories that
ownership and membership do not already cover. Search queries cap at 256 characters, so repository
qualifiers pack into as few queries as fit, and each chunked group is bounded (two queries for
member, three for watched) to keep a page load well inside search's 30-requests-per-minute limit;
groups cut short mark themselves `truncated`. An app that was never granted organization or watching
visibility reports those groups empty rather than failing the list, while a failing search answers
502 so the client can tell "try again later" from "nothing to show". Signed-out visitors never hit
the endpoint and the page renders exactly as before.
