# alchemy-state-viewer

A read-only web viewer for [alchemy-effect](https://github.com/DavidJFelix/alchemy-effect)
Infrastructure-as-Effects state, deployed as a SvelteKit app on Cloudflare Workers. It browses the
alchemy Cloudflare state store (the `alchemy-state-store` worker) over its HTTP API: stacks, stages,
per-resource state (props, attributes, bindings, downstream edges, replacement backlog), and stack
outputs. Styling is Panda CSS (semantic tokens, light/dark via `prefers-color-scheme`); interactive
components are Ark UI for Svelte (JSON tree views, collapsible sections).

## How it reads state

Alchemy persists deployment state in a per-account Cloudflare worker
(`https://alchemy-state-store.<subdomain>.workers.dev`) behind a bearer token. This app proxies that
API server-side -- the token never reaches the browser -- and masks every persisted secret: alchemy
stores `Redacted<T>` values as `{"__redacted__": <value>}` envelopes, which the server replaces with
a placeholder before rendering. Durations (`{"__duration__": ...}`) are prettified to human-readable
strings.

## Configuration

All runtime configuration is committed in `wrangler.toml` -- there are no manual post-deploy steps:

- `ALCHEMY_STATE_URL` -- a plain `[vars]` entry (not a secret: the URL is derivable from the
  account's workers.dev subdomain; the store is protected by its bearer token, not obscurity).
- `ALCHEMY_STATE_TOKEN_SECRET` -- a `secrets_store_secrets` binding to the `AlchemyStateStoreToken`
  secret the alchemy bootstrap already keeps in the account Secrets Store. The token value is never
  copied into this worker's own secrets, and rotation is picked up automatically. Deploying with
  this binding requires the API token to hold Account Secrets Store Edit.
- `ALCHEMY_STATE_STORE` -- a service binding to the `alchemy-state-store` worker. Same-zone
  worker-to-worker global fetch is blocked by Cloudflare (error 1042, surfaced as HTTP 404), so
  deployed requests ride the binding and stay inside Cloudflare.

Local dev reads `.dev.vars` (see `.dev.vars.example`): an `ALCHEMY_STATE_TOKEN` string override,
since the real binding is not available locally. The smoke gate blanks `ALCHEMY_STATE_URL`
(`wrangler dev --var`) so it exercises the deterministic unconfigured boot, which renders setup
instructions instead of erroring.

## Access control

The app does no authentication of its own. The deployed worker MUST sit behind
[Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/): enable
Access on the worker's workers.dev route (Zero Trust dashboard) before configuring
`ALCHEMY_STATE_URL` -- infrastructure state is sensitive even with persisted secrets masked. Order
matters: without configuration the app only serves setup instructions, so deploy first, gate with
Access, then configure.

Note the residual scope either way: the state store has a single bearer token and it authorizes the
full API, writes included, even though this viewer only reads. A read-only grant would need support
in alchemy itself.

## Development

```sh
pnpm install
pnpm run dev        # vite dev server on :3007
mise run check      # typecheck, lint, format, test, build
mise run smoke      # boots the built worker in wrangler dev and probes it
```
