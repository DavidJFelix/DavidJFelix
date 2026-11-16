### fix(revision.city): log who refused a GitHub token exchange

A failed sign-in token exchange now logs every response header except `Set-Cookie`, and the first
500 characters of a body that is not JSON. The 429s from 2026-11-12 had no headers or body in the
log, so it was not possible to say which layer sent them. A JSON body is never logged, because it
can hold a token. The comment on the retry no longer says that github.com limits by IP address or
that Workers share addresses, because that is not proven.
