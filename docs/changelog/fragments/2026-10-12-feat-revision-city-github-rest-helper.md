### feat(revision.city): add a GitHub REST helper

revision.city has a small GitHub REST client. It sends the API version and user agent headers, an
optional token, and an optional JSON body. It checks each response against a zod schema, and a
failed request throws a `GitHubApiError` that has the HTTP status. The client reads list endpoints
page by page, up to a page limit. It lists the files of a pull request in this way, up to GitHub's
limit of 3000 files. Nothing uses the client yet.
