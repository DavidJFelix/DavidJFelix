### chore(repo): export workers logs and traces to grafana cloud

Every app's wrangler config now enables observability logs and traces explicitly and wires them to
the account-level OTLP destinations created in the Cloudflare dashboard
(`2026-aug-16-grafana-cloud-logs` and `2026-aug-16-grafana-cloud-traces`), replacing the bare
`[observability] enabled = true` blocks. f311x gets the same config through the `observability`
prop in `alchemy.run.ts`, since Alchemy owns that deploy and never reads wrangler.toml's
observability tables; revision.city's dev environment repeats the config in full because an
environment that defines any observability of its own replaces the inherited tables wholesale.
