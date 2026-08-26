### feat(djf.io): declare content signals in robots.txt

robots.txt now carries a `Content-Signal` line under `User-agent: *` declaring the site's
preferences for automated content use per [Content Signals](https://contentsignals.org/):
`search=yes, ai-input=yes, ai-train=no, use=reference` -- `use=reference` is Cloudflare's
content-use signal permitting indexing, excerpting, and linking back. Search indexing and real-time
AI use of the content stay welcome -- the site already serves markdown to agents on content
negotiation, so `ai-input=no` would have contradicted its own behavior -- while training on the
content is declined. The seo e2e test that fetches robots.txt now also asserts the `Content-Signal`
line so the declaration cannot silently regress.
