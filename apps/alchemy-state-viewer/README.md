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

Two runtime secrets (see `.dev.vars.example`; local dev reads `.dev.vars`):

| Secret                | Purpose                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| `ALCHEMY_STATE_URL`   | Base URL of the state store worker                                                                       |
| `ALCHEMY_STATE_TOKEN` | Bearer token (cached by the alchemy CLI under `~/.alchemy/credentials/<profile>/cloudflare-state-store`) |

Unconfigured, the app renders setup instructions instead of erroring -- that keeps the smoke gate
deterministic and secret-free.

```sh
wrangler secret put ALCHEMY_STATE_URL
wrangler secret put ALCHEMY_STATE_TOKEN
```

## Access control

The app does no authentication of its own. The deployed worker MUST sit behind
[Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/): enable
Access on the worker's workers.dev route (Zero Trust dashboard) before setting the `ALCHEMY_STATE_*`
secrets -- infrastructure state is sensitive even with persisted secrets masked. Order matters:
without the secrets the app only serves setup instructions, so deploy first, gate with Access, then
configure.

## Development

```sh
pnpm install
pnpm run dev        # vite dev server on :3007
mise run check      # typecheck, lint, format, test, build
mise run smoke      # boots the built worker in wrangler dev and probes it
```
