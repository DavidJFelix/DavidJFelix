# alchemy-state-viewer

A read-only web viewer for [alchemy-effect](https://github.com/DavidJFelix/alchemy-effect)
Infrastructure-as-Effects state, deployed as a SvelteKit app on Cloudflare Workers. It browses the
alchemy Cloudflare state store (the `alchemy-state-store` worker) over its HTTP API: stacks, stages,
per-resource state (props, attributes, bindings, downstream edges, replacement backlog), and stack
outputs.

## How it reads state

Alchemy persists deployment state in a per-account Cloudflare worker
(`https://alchemy-state-store.<subdomain>.workers.dev`) behind a bearer token. This app proxies
that API server-side -- the token never reaches the browser -- and masks every persisted secret:
alchemy stores `Redacted<T>` values as `{"__redacted__": <value>}` envelopes, which the server
replaces with a placeholder before rendering. Durations (`{"__duration__": ...}`) are prettified to
human-readable strings.

## Configuration

Three runtime secrets (see `.dev.vars.example`; local dev reads `.dev.vars`):

| Secret                | Purpose                                                                |
| --------------------- | ---------------------------------------------------------------------- |
| `ALCHEMY_STATE_URL`   | Base URL of the state store worker                                     |
| `ALCHEMY_STATE_TOKEN` | Bearer token (cached by the alchemy CLI under `~/.alchemy/credentials/<profile>/cloudflare-state-store`) |
| `APP_PASSWORD`        | HTTP Basic auth password for the viewer itself (any username)          |

Unconfigured, the app renders setup instructions instead of erroring -- that keeps the smoke gate
deterministic and secret-free. `APP_PASSWORD` is optional in code but mandatory in practice for a
deployed instance: infrastructure state is sensitive even with secrets masked. Set it (or put
Cloudflare Access in front of the worker) before pointing real credentials at a deployment.

```sh
wrangler secret put ALCHEMY_STATE_URL
wrangler secret put ALCHEMY_STATE_TOKEN
wrangler secret put APP_PASSWORD
```

## Development

```sh
pnpm install
pnpm run dev        # vite dev server on :3007
mise run check      # typecheck, lint, format, test, build
mise run smoke      # boots the built worker in wrangler dev and probes it
```
