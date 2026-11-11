### test(revision.city): pin the diff route's host allowlist

The diff route tests now have a table of 18 inputs that the route must reject with a 400 and no
upstream fetch. The rows cover unknown and look-alike hosts and domains, plain http, a port, a user
name, a password and a trailing dot. They also cover an off-pattern raw diff path, bad paths and no
input. Three more rows send odd inputs that the route accepts. They check that each fetch goes to an
allowed host over https with no port. Two tests cover the 415 answer for a body that is not a diff
and the 422 answer for an empty diff. The production code does not change.
