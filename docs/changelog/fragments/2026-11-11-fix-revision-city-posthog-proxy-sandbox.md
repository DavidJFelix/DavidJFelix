### fix(revision.city): sandbox PostHog proxy answers and test the cookie strip

Every answer that the PostHog proxy at `/diag/*` forwards from PostHog now carries a
`Content-Security-Policy: sandbox` header, so an upstream answer that a browser opens as a page gets
an opaque origin. The proxy moved into `src/lib/posthog-proxy.ts`, where tests under the coverage
gate prove that it removes the site cookie before a forward.
