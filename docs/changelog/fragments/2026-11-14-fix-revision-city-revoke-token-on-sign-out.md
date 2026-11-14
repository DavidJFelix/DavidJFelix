### fix(revision.city): revoke the GitHub token on sign-out

Sign-out now asks GitHub to revoke the access token of that session before it clears the cookie, so
a copy of the cookie stops working when the visitor signs out. The revoke is best effort: when
GitHub refuses it, is slow for more than 3 seconds, or cannot be reached, the worker logs the
failure with the step `token revoke`, and the sign-out continues as before.
