### fix(revision.city): limit preview sign-in to the dev worker's own previews

Preview sign-in now runs only on the dev worker, the origin that `PREVIEW_AUTH_PROXY_URL` names, and
it accepts only `pr-<N>-<dev worker>.<subdomain>.workers.dev` callbacks, where the worker name and
the subdomain come from that same URL. Production has no `PREVIEW_AUTH_PROXY_URL`, so it does an
ordinary sign-in for every request. This corrects the August entry that said production cannot
proxy: before this change, only the preview side of the flow checked the hostname.
