### feat(djf.io): publish DNS for AI Discovery (DNS-AID) records

Agent-readiness scanners found no DNS-AID well-known entry points under djf.io, so agents probing
the `_agents` DNS namespace (draft-mozleywilliams-dnsop-dnsaid) got NXDOMAIN. The zone now gets a
ServiceMode SVCB record (RFC 9460) at `_index._agents.djf.io` designating the site itself -- every
page already negotiates to markdown for agents -- with `alpn` and port parameters; protocol leaves
like `_a2a._agents` stay unpublished until an A2A or MCP endpoint exists to back them. The desired
set and reconcile planner live in `src/lib/dns-aid.ts` (unit-tested, coverage-gated), and
`mise run sync-dns-aid` (`bin/sync-dns-aid.ts`, mirroring `sync-standard-site`) idempotently upserts
the records through the Cloudflare API with `CLOUDFLARE_API_TOKEN`, asks Cloudflare to DNSSEC-sign
the zone if it is not already, and verifies the records resolve over DNS-over-HTTPS.
