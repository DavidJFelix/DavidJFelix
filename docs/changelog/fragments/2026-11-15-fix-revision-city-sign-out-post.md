### fix(revision.city): make sign-out a POST

The sign-out route now answers only POST, and it refuses a request whose Origin header names another
site. The Sign out button submits a form instead of opening a link. Before, a link on any other site
could sign a visitor out and revoke their GitHub token.
