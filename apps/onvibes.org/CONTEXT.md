# onvibes.org -- domain context

Glossary of domain language for onvibes. Terms here are canonical; use them in code, docs, and
discussion. Implementation details do not belong in this file.

## Terms

### Onvibes (the agent)

Onvibes is an agent. The website is a way to reach it, not the product itself. (The earlier
"builder toolchain" framing is dead -- do not reintroduce it.)

### User

Someone who has signed up on onvibes.org. Signing up is open to anyone, happens via GitHub OAuth
(a user is their GitHub identity; no passwords exist in this app), and creates a user record in the
app's database. A user, by itself, grants no ability to do anything.

### Enabled (working term)

The manually granted permission that lets a user actually use the agent. Granted today by flipping
a field on the user's database row by hand; the granting mechanism is expected to be replaced later
(billing, admin panel -- deliberately undecided). Users are disabled by default.
