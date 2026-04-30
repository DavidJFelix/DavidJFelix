# Setup Hermes

## Goal

Get Hermes running somewhere it can be accessed securely from anywhere, backed by sensible API/provider choices for model access. Most of the work is research and decision-making, then a one-time setup.

## Open Questions

### Hosting

Where should Hermes run? Options to evaluate:

- Self-hosted on a home server / NAS
- VPS (Hetzner, Fly.io, Railway, etc.)
- Cloudflare (Workers / Containers)
- Vercel
- A dedicated cloud VM

Decision criteria: cost, latency, persistence needs, runtime fit (long-running vs. request/response), ease of updates.

### Access

Use Tailscale for secure remote access. Decide:

- Tailscale on the host directly vs. a sidecar/subnet router
- Whether to expose via Tailscale Funnel/Serve or keep tailnet-only
- ACLs and tagging
- MagicDNS hostname

### API / Model Providers

Investigate which providers (and gateways) to wire up:

- [Daytona](https://daytona.io) — sandboxes for code execution
- Cloudflare AI Gateway — caching, rate limiting, observability
- OpenRouter — multi-model routing
- Vercel Sandboxes
- Direct provider APIs (Anthropic, OpenAI, etc.)

Decision criteria: which combination gives the best mix of model coverage, sandboxed code execution, observability, and cost control. Likely some combination, not just one.

## Phases

1. **Research** — survey hosting, Tailscale integration patterns, and provider/gateway landscape; capture findings in progress notes.
2. **Decide** — pick hosting + access pattern + provider stack.
3. **Set up** — provision host, install Hermes, wire Tailscale, configure providers, smoke test from a remote device.
4. **Document** — write down the resulting setup so it's reproducible.
