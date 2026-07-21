// Read-only view types and display helpers for alchemy persisted state.
//
// Mirrors the wire shapes of alchemy-effect's State module
// (packages/alchemy/src/State/{ResourceState,ActionState,StateEncoding}.ts)
// loosely: every field the UI renders is optional so an older or newer store
// still displays instead of crashing.

/** Marker key alchemy uses to persist `Redacted<T>` secrets. */
export const REDACTED_MARKER = '__redacted__'

/** Marker key alchemy uses to persist `Duration` values. */
export const DURATION_MARKER = '__duration__'

/** Placeholder substituted for redacted values before data leaves the server. */
export const REDACTED_PLACEHOLDER = '••• redacted'

export const RESOURCE_STATUSES = [
  'creating',
  'created',
  'updating',
  'updated',
  'deleting',
  'replacing',
  'replaced',
] as const

export const ACTION_STATUSES = ['running', 'ran'] as const

export type ResourceStatus = (typeof RESOURCE_STATUSES)[number]
export type ActionStatus = (typeof ACTION_STATUSES)[number]

/** A resource or action row as persisted under an FQN in the state store. */
export interface PersistedStateView {
  kind?: 'resource' | 'action'
  fqn?: string
  logicalId?: string
  status?: string
  downstream?: string[]
  // resource fields
  resourceType?: string
  instanceId?: string
  providerVersion?: number
  bindings?: unknown[]
  props?: Record<string, unknown>
  attr?: Record<string, unknown>
  old?: Record<string, unknown>
  removalPolicy?: unknown
  deleteFirst?: boolean
  // action fields
  actionType?: string
  input?: unknown
  output?: unknown
  inputHash?: string
}

/** Actions share the FQN namespace; legacy rows without `kind` are resources. */
export const isAction = (state: PersistedStateView): boolean => state.kind === 'action'

/** The `resourceType` / `actionType` of a row, whichever kind it is. */
export const typeOf = (state: PersistedStateView): string =>
  (isAction(state) ? state.actionType : state.resourceType) ?? 'unknown'

export type StatusTone = 'ok' | 'busy' | 'warn' | 'unknown'

/**
 * Presentation for a status: settled states are `ok`, in-flight states are
 * `busy`, and states pointing at pending replacement cleanup are `warn`.
 */
export const statusTone = (status: string | undefined): StatusTone => {
  switch (status) {
    case 'created':
    case 'updated':
    case 'ran':
      return 'ok'
    case 'creating':
    case 'updating':
    case 'deleting':
    case 'replacing':
    case 'running':
      return 'busy'
    case 'replaced':
      return 'warn'
    default:
      return 'unknown'
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const formatDuration = (encoded: unknown): string | undefined => {
  if (!isPlainObject(encoded)) return undefined
  const {_tag: tag, millis, nanos} = encoded
  switch (tag) {
    case 'Millis':
      return typeof millis === 'number' ? `${millis}ms` : undefined
    case 'Nanos':
      return typeof nanos === 'string' ? `${nanos}ns` : undefined
    case 'Infinity':
      return 'infinite'
    case 'NegativeInfinity':
      return '0ms'
    default:
      return undefined
  }
}

/**
 * Recursively replace alchemy's persistence markers with display-safe values:
 * `{__redacted__: secret}` becomes {@link REDACTED_PLACEHOLDER} (the secret is
 * dropped entirely -- this MUST run server-side before state is returned to
 * the browser) and `{__duration__: ...}` becomes a human-readable string.
 * Marker envelopes are matched exactly as alchemy's reviver does: a single-key
 * object.
 */
export const maskState = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map((entry) => maskState(entry))
  if (!isPlainObject(value)) return value
  const keys = Object.keys(value)
  if (keys.length === 1 && keys[0] === REDACTED_MARKER) {
    return REDACTED_PLACEHOLDER
  }
  if (keys.length === 1 && keys[0] === DURATION_MARKER) {
    return formatDuration(value[DURATION_MARKER]) ?? maskState(value[DURATION_MARKER])
  }
  const result: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    result[key] = maskState(entry)
  }
  return result
}

/** Counts per status across a stage's rows, in a stable display order. */
export const statusCounts = (states: PersistedStateView[]): Array<[string, number]> => {
  const counts = new Map<string, number>()
  for (const state of states) {
    const status = state.status ?? 'unknown'
    counts.set(status, (counts.get(status) ?? 0) + 1)
  }
  return [...counts.entries()].toSorted(([a], [b]) => a.localeCompare(b))
}
