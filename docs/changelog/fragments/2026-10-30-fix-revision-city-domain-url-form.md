### fix(revision.city): open pasted Codeberg and Tangled URLs on their own host

A Codeberg or Tangled URL pasted into the viewer's URL box opened as a GitHub diff and failed. The
form put the `?domain=` query inside the router's splat parameter, and the router encoded the `?` as
`%3F`, so the viewer got no domain. The form now passes the domain as a search parameter.
