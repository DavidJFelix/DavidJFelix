### fix(revision.city): sandbox PostHog proxy answers and test the cookie strip

The PostHog proxy at `/diag/*` now refuses methods other than GET and POST with a 405, and every
answer it returns carries a `Content-Security-Policy: sandbox` header, so an upstream answer that a
browser opens as a page gets an opaque origin. The proxy moved into `src/lib/posthog-proxy.ts`,
where tests under the coverage gate prove that it removes the site cookie before a forward.
