import {expect, test} from 'vitest'
import {
  DNS_AID_RECORDS,
  type DnsAidRecord,
  type ExistingDnsRecord,
  planRecordActions,
  recordMatchesDesired,
  ZONE_NAME,
} from './dns-aid'

const INDEX = DNS_AID_RECORDS[0]

// An existing Cloudflare record that mirrors a desired one, for drift cases to
// perturb. Cloudflare returns names without the root dot, like the desired set.
function existingFrom(record: DnsAidRecord): ExistingDnsRecord {
  return {
    id: 'record-id-1',
    name: record.name,
    type: record.type,
    ttl: record.ttl,
    data: {...record.data},
  }
}

test('every published record lives under the _agents namespace of the zone', () => {
  for (const record of DNS_AID_RECORDS) {
    expect(record.name.endsWith(`._agents.${ZONE_NAME}`)).toBe(true)
  }
})

test('every published record is a ServiceMode SVCB record with alpn and an endpoint', () => {
  for (const record of DNS_AID_RECORDS) {
    expect(record.type).toBe('SVCB')
    // Priority 0 would be AliasMode (RFC 9460); discovery leaves are ServiceMode.
    expect(record.data.priority).toBeGreaterThanOrEqual(1)
    expect(record.data.value).toContain('alpn=')
    // The endpoint is the TargetName -- "." would point back at the _agents leaf.
    expect(record.data.target).not.toBe('.')
    expect(record.data.target.length).toBeGreaterThan(0)
  }
})

test('the organization index record designates the site itself over HTTPS', () => {
  expect(INDEX.name).toBe('_index._agents.djf.io')
  expect(INDEX.data.target).toBe('djf.io')
  expect(INDEX.data.value).toContain('port="443"')
})

test('recordMatchesDesired accepts an in-sync record', () => {
  expect(recordMatchesDesired(existingFrom(INDEX), INDEX)).toBe(true)
})

test('recordMatchesDesired tolerates DNS presentation differences', () => {
  const existing = existingFrom(INDEX)
  existing.data = {
    ...existing.data,
    target: `${INDEX.data.target.toUpperCase()}.`,
    value: `  ${INDEX.data.value.replace(' ', '   ')} `,
  }
  expect(recordMatchesDesired(existing, INDEX)).toBe(true)
})

test.each([
  ['ttl', {ttl: 300}],
  ['priority', {data: {...INDEX.data, priority: 2}}],
  ['target', {data: {...INDEX.data, target: 'agents.djf.io'}}],
  ['value', {data: {...INDEX.data, value: 'alpn="h2"'}}],
])('recordMatchesDesired rejects drift in %s', (_field, drift) => {
  const existing = {...existingFrom(INDEX), ...drift}
  expect(recordMatchesDesired(existing, INDEX)).toBe(false)
})

test('planRecordActions creates records that do not exist yet', () => {
  expect(planRecordActions([], DNS_AID_RECORDS)).toEqual(
    DNS_AID_RECORDS.map((record) => ({kind: 'create', record})),
  )
})

test('planRecordActions keeps an in-sync record', () => {
  const actions = planRecordActions([existingFrom(INDEX)], [INDEX])
  expect(actions).toEqual([{kind: 'keep', id: 'record-id-1', record: INDEX}])
})

test('planRecordActions updates a drifted record in place', () => {
  const drifted = {...existingFrom(INDEX), ttl: 300}
  const actions = planRecordActions([drifted], [INDEX])
  expect(actions).toEqual([{kind: 'update', id: 'record-id-1', record: INDEX}])
})

test('planRecordActions matches names case-insensitively and ignores the root dot', () => {
  const existing = {...existingFrom(INDEX), name: `${INDEX.name.toUpperCase()}.`}
  const actions = planRecordActions([existing], [INDEX])
  expect(actions[0]?.kind).toBe('keep')
})

test('planRecordActions never touches records outside the desired set', () => {
  const unrelated: ExistingDnsRecord = {
    id: 'record-id-2',
    name: `_index._agents.${ZONE_NAME}`,
    // Same name, different type -- e.g. a TXT challenge record on the leaf.
    type: 'TXT',
    ttl: 3600,
  }
  const actions = planRecordActions([unrelated], [INDEX])
  expect(actions).toEqual([{kind: 'create', record: INDEX}])
})
