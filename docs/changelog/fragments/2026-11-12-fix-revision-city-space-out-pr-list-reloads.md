### fix(revision.city): space out pull request list reloads and ask for a new sign-in

The home page's pull request list now reloads on window focus only when the last load started 30
seconds ago or more, so a visitor who switches windows often does not use up GitHub's search rate
limit. When GitHub rejects the visitor's token, the list shows "GitHub rejected your sign-in. Sign
in again." with a sign-in button, in place of a stale list or a general error.
