### feat(revision.city): add the inbox page with the pull request list

The new `/inbox` page lists the open pull requests of the signed-in visitor, with the most recent
update first. Each row links to the pull request in the viewer. It shows the title, a draft badge,
the repository and number, the author, the inbox reasons and the time of the last update. A
signed-out visitor gets a "Sign in with GitHub" button that comes back to `/inbox`. The `/diffs`
page no longer lists pull requests: a signed-in visitor gets a link to the inbox there.
