// Publishes djf.io's DNS for AI Discovery (DNS-AID) records to the Cloudflare
// zone: ServiceMode SVCB records under the _agents namespace
// (draft-mozleywilliams-dnsop-dnsaid; the record type is RFC 9460), so agent
// crawlers can discover the site's agent-facing entry point from DNS alone.
// Idempotent and non-destructive: it creates missing records and updates
// drifted ones, but never deletes -- pruning is a manual step. It also asks
// Cloudflare to DNSSEC-sign the zone if it is not already (the draft says
// discovery zones SHOULD be signed), and finishes by resolving each record
// over DNS-over-HTTPS the way validators like isitagentready.com do.
// cSpell:words isitagentready
// The desired records and the reconcile planner live in ../src/lib/dns-aid.
//
// Auth uses CLOUDFLARE_API_TOKEN (never committed), scoped to the djf.io zone
// with DNS:Edit plus DNSSEC:Edit.
// Run: mise run sync-dns-aid.

import {z} from 'zod'
import {DNS_AID_RECORDS, planRecordActions, ZONE_NAME} from '../src/lib/dns-aid'

const API_BASE = 'https://api.cloudflare.com/client/v4'

// The uniform Cloudflare v4 response envelope; each call validates `result`
// against its own schema below, so no response crosses into typed code unparsed.
const ENVELOPE = z.object({
  success: z.boolean(),
  errors: z.array(z.object({code: z.number(), message: z.string()})).optional(),
  result: z.unknown(),
})

interface CloudflareRequestParams<T> {
  token: string
  path: string
  result: z.ZodType<T>
  method?: 'GET' | 'POST' | 'PATCH'
  body?: unknown
}

async function cloudflare<T>({
  token,
  path,
  result,
  method = 'GET',
  body,
}: CloudflareRequestParams<T>): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : {'content-type': 'application/json'}),
    },
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
  })
  const envelope = ENVELOPE.safeParse(await response.json().catch(() => undefined))
  if (!response.ok || !envelope.success || !envelope.data.success) {
    const detail =
      envelope.data?.errors?.map((error) => `${error.code}: ${error.message}`).join('; ') ??
      `HTTP ${response.status}`
    throw new Error(`Cloudflare API ${method} ${path} failed (${detail})`)
  }
  return result.parse(envelope.data.result)
}

const ZONES = z.array(z.object({id: z.string(), name: z.string()}))

async function lookupZoneId(token: string): Promise<string> {
  const zones = await cloudflare({token, path: `/zones?name=${ZONE_NAME}`, result: ZONES})
  const zone = zones.find((candidate) => candidate.name === ZONE_NAME)
  if (!zone) {
    throw new Error(`Zone '${ZONE_NAME}' not visible to this token; check its zone scope.`)
  }
  return zone.id
}

// Matches ExistingDnsRecord (src/lib/dns-aid.ts), which the planner consumes.
const EXISTING_RECORDS = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    ttl: z.number(),
    data: z
      .object({
        priority: z.number().optional(),
        target: z.string().optional(),
        value: z.string().optional(),
      })
      .optional(),
  }),
)

interface ZoneScopeParams {
  token: string
  zoneId: string
}

async function syncRecords({token, zoneId}: ZoneScopeParams): Promise<void> {
  // One page covers it: the zone holds a handful of SVCB records at most.
  const existing = await cloudflare({
    token,
    path: `/zones/${zoneId}/dns_records?type=SVCB&per_page=100`,
    result: EXISTING_RECORDS,
  })
  // Sequential on purpose: keeps log output ordered and the API gently used.
  for (const action of planRecordActions(existing, DNS_AID_RECORDS)) {
    if (action.kind === 'create') {
      await cloudflare({
        token,
        method: 'POST',
        path: `/zones/${zoneId}/dns_records`,
        body: action.record,
        result: z.unknown(),
      })
      console.log(`created ${action.record.type} '${action.record.name}'`)
    } else if (action.kind === 'update') {
      await cloudflare({
        token,
        method: 'PATCH',
        path: `/zones/${zoneId}/dns_records/${action.id}`,
        body: action.record,
        result: z.unknown(),
      })
      console.log(`updated ${action.record.type} '${action.record.name}'`)
    } else {
      console.log(`kept ${action.record.type} '${action.record.name}' (already in sync)`)
    }
  }
}

const DNSSEC_STATUS = z.object({
  status: z.enum(['active', 'pending', 'disabled', 'pending-disabled', 'error']),
  ds: z.string().nullish(),
})

async function ensureDnssec({token, zoneId}: ZoneScopeParams): Promise<void> {
  const path = `/zones/${zoneId}/dnssec`
  const current = await cloudflare({token, path, result: DNSSEC_STATUS})
  // 'pending' means the zone is already signed and Cloudflare is waiting for
  // the DS record to land at the registrar; re-submitting would be a no-op, so
  // only the disabled states get patched back to active.
  const settled =
    current.status === 'disabled' || current.status === 'pending-disabled'
      ? await cloudflare({
          token,
          method: 'PATCH',
          path,
          body: {status: 'active'},
          result: DNSSEC_STATUS,
        })
      : current
  console.log(`dnssec: ${settled.status}`)
  if (settled.status !== 'active' && settled.ds) {
    console.log(
      'dnssec: publish this DS record at the registrar to complete the chain of trust' +
        ' (automatic on Cloudflare Registrar):',
    )
    console.log(settled.ds)
  }
}

// RFC 9460 assigns the SVCB RR type number 64; dns-json answers carry it numerically.
const SVCB_RR_TYPE = 64

const DOH_ANSWER = z.object({
  Status: z.number(),
  AD: z.boolean().default(false),
  Answer: z.array(z.object({type: z.number()})).optional(),
})

async function verifyOverDoh(): Promise<void> {
  for (const record of DNS_AID_RECORDS) {
    const response = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${record.name}&type=${record.type}`,
      {headers: {accept: 'application/dns-json'}},
    )
    const answer = DOH_ANSWER.parse(await response.json())
    const found = answer.Status === 0 && (answer.Answer ?? []).some((a) => a.type === SVCB_RR_TYPE)
    if (found) {
      const authenticity = answer.AD ? 'DNSSEC-authenticated' : 'not yet DNSSEC-authenticated'
      console.log(`verified '${record.name}' over DoH (${authenticity})`)
    } else {
      // Resolver caches can hold a pre-sync NXDOMAIN for up to the negative TTL.
      console.log(`'${record.name}' not yet visible over DoH; caches may lag the sync`)
    }
  }
}

const token = process.env.CLOUDFLARE_API_TOKEN
if (!token) {
  throw new Error('CLOUDFLARE_API_TOKEN is not set; cannot sync DNS-AID records.')
}
const zoneId = await lookupZoneId(token)
await syncRecords({token, zoneId})
await ensureDnssec({token, zoneId})
await verifyOverDoh()
console.log(`done: ${DNS_AID_RECORDS.length} record(s) reconciled`)
