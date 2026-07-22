### fix(alchemy-state-viewer): reach the state store through a service binding

The deployed viewer's requests to the state store 404'd: Cloudflare blocks same-zone
worker-to-worker global fetch (error 1042, surfaced as HTTP 404), and both workers live on the
account's workers.dev zone. Requests now ride an `ALCHEMY_STATE_STORE` service binding to the
`alchemy-state-store` worker -- the documented mechanism, which also keeps the hop inside Cloudflare
with no public round-trip. The config resolver attaches the binding's fetcher on the deployed
(Secrets-Store-token) path only; local dev's string-token path keeps global fetch, which works fine
from outside Cloudflare.
