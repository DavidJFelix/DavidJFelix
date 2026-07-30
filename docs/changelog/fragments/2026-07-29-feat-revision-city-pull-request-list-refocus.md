### feat(revision.city): refresh the home pull request list on window refocus

The open pull request list on the `/diffs` home page loaded once per visit, so it drifted stale the
moment the visitor went off to merge or open pull requests in another tab. A refetch now runs
whenever the window regains focus, stale-while-revalidate style: the already loaded groups stay on
screen during the refetch instead of collapsing back to a loading message, a refetch that fails
keeps them too rather than replacing a working list with an error line, and a refocus while a
refetch is already in flight does not stack another request. Only the first load ever shows the
loading state; signed-out visitors still never hit the endpoint.
