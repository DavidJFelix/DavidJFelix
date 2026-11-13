### fix(revision.city): retry a GitHub sign-in that github.com throttles

github.com answered the sign-in's code exchange with 429 three times in a row on 2026-11-12, so the
callback showed "GitHub sign-in failed". github.com limits requests by IP address, and Workers share
their outgoing addresses. The exchange now tries up to three times when GitHub answers 429, logs the
`Retry-After` header, and, if every attempt is throttled, answers 503 with a message that names the
rate limit.
