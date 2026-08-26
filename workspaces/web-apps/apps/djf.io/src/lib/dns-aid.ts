// Shared, framework-agnostic source of truth for djf.io's DNS for AI Discovery
// (DNS-AID) records -- the _agents DNS namespace that lets agent crawlers find
// the site's agent-facing entry point from DNS alone
// (draft-mozleywilliams-dnsop-dnsaid; the SVCB record type itself is RFC 9460).
// Pure -- no I/O -- so the bun sync script (bin/sync-dns-aid.ts) and the tests
// share the same constants and reconcile planner. All Cloudflare API calls live
// in the sync script.

export const ZONE_NAME = 'djf.io'

// A desired record, shaped exactly like the Cloudflare DNS record API body
// (data.value carries the RFC 9460 SvcParams in presentation format, values
// quoted the way Cloudflare's own examples quote them).
export interface DnsAidRecord {
  name: string
  type: 'SVCB'
  ttl: number
  comment: string
  data: {priority: number; target: string; value: string}
}

// The published set. Only what djf.io actually serves: the organization index
// leaf (_index._agents) as a ServiceMode record (priority 1) designating the
// site itself -- every page negotiates to markdown for agents over plain HTTPS
// (src/lib/markdown-for-agents.ts), which is the honest entry point. Protocol
// leaves like _a2a._agents or _mcp._agents are deliberately absent until an
// A2A or MCP endpoint exists to back them.
export const DNS_AID_RECORDS: ReadonlyArray<DnsAidRecord> = [
  {
    name: `_index._agents.${ZONE_NAME}`,
    type: 'SVCB',
    ttl: 3600,
    comment: 'DNS-AID organization index (draft-mozleywilliams-dnsop-dnsaid)',
    data: {priority: 1, target: ZONE_NAME, value: 'alpn="h3,h2" port="443"'},
  },
]

// --- Reconcile planner (pure; executed by bin/sync-dns-aid.ts) ---------------
//
// The sync is idempotent: an existing record for a desired name is updated in
// place when it drifted and left alone when it matches; missing records are
// created. It is intentionally non-destructive -- records outside the desired
// set are never touched, so a sync can never wipe a record.

export interface ExistingDnsRecord {
  id: string
  name: string
  type: string
  ttl: number
  data?: {priority?: number; target?: string; value?: string}
}

export type RecordAction =
  | {kind: 'create'; record: DnsAidRecord}
  | {kind: 'update'; id: string; record: DnsAidRecord}
  | {kind: 'keep'; id: string; record: DnsAidRecord}

// DNS names compare case-insensitively and with or without the root dot.
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\.$/, '')
}

// Cloudflare may reformat the SvcParams string it stores (spacing), so the
// value compares on a whitespace-collapsed form rather than byte-for-byte.
function normalizeSvcParams(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function recordMatchesDesired(existing: ExistingDnsRecord, desired: DnsAidRecord): boolean {
  return (
    existing.ttl === desired.ttl &&
    existing.data?.priority === desired.data.priority &&
    normalizeName(existing.data?.target ?? '') === normalizeName(desired.data.target) &&
    normalizeSvcParams(existing.data?.value ?? '') === normalizeSvcParams(desired.data.value)
  )
}

export function planRecordActions(
  existing: ReadonlyArray<ExistingDnsRecord>,
  desired: ReadonlyArray<DnsAidRecord>,
): Array<RecordAction> {
  return desired.map((record) => {
    const current = existing.find(
      (candidate) =>
        candidate.type === record.type &&
        normalizeName(candidate.name) === normalizeName(record.name),
    )
    if (!current) return {kind: 'create', record}
    return recordMatchesDesired(current, record)
      ? {kind: 'keep', id: current.id, record}
      : {kind: 'update', id: current.id, record}
  })
}
