### test(revision.city): assert a refreshed session cookie on the diff and pull request routes

The diff route and the pull request list now each have a test for an expired session token. The test
makes sure that the route sends the refreshed token to GitHub and that the answer gives the new
session cookie to the browser. Before, only the auth helper had this test, so a route that stopped
forwarding the cookie still passed CI.
