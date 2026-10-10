// A `Worker` reports a failure with an `error` event. Chromium sends a plain `Event`, with no
// message, when it cannot fetch the worker script (an error status or a network error). It sends an
// `ErrorEvent` when the script throws. In a classic worker, a script that is not JavaScript throws.
// Firefox also sends a plain `Event` when the script does not parse, for example a truncated script.

type WorkerFailureFetch = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>

const RELOAD_TIMEOUT_MS = 5000

export type WorkerScriptReload =
  | {kind: 'response'; status: number; contentType: string | null; byteLength: number}
  | {kind: 'network-error'; message: string}

export type WorkerRecovery = 'retry-pool' | 'reload-page' | 'none'

export interface ReloadWorkerScriptParams {
  scriptUrl: string
  fetch?: WorkerFailureFetch
}

// The plain `Event` has no status or cause, so a second request is the only way to see what the
// server returns for the script. A `reload` request also replaces a truncated copy in the HTTP
// cache, which Firefox otherwise uses again after each 304 revalidation.
export async function reloadWorkerScript({
  scriptUrl,
  fetch: fetcher = fetch,
}: ReloadWorkerScriptParams): Promise<WorkerScriptReload> {
  try {
    const response = await fetcher(scriptUrl, {
      cache: 'reload',
      signal: AbortSignal.timeout(RELOAD_TIMEOUT_MS),
    })
    const body = await response.arrayBuffer()
    return {
      kind: 'response',
      status: response.status,
      contentType: response.headers.get('content-type'),
      byteLength: body.byteLength,
    }
  } catch (error) {
    return {kind: 'network-error', message: String(error)}
  }
}

// A 200 means that the server has the script and the cache now holds a complete copy of it, so a
// second start of the pool can work. A 404 means that a deploy removed the script this page asks
// for. Only a new load of the page gets the names of the scripts in the current deploy.
export function chooseWorkerRecovery(reload: WorkerScriptReload): WorkerRecovery {
  if (reload.kind === 'network-error') return 'none'
  if (reload.status === 200) return 'retry-pool'
  return reload.status === 404 ? 'reload-page' : 'none'
}

const RecoveryDescriptions: Record<WorkerRecovery, string> = {
  'retry-pool': ' The page starts the worker pool again.',
  'reload-page': ' The page reloads once to get the current deploy.',
  none: '',
}

export function describeWorkerThrow(event: ErrorEvent): string {
  return `The diffs worker threw at ${event.filename}:${event.lineno}:${event.colno}: ${event.message}. ${describePage()}`
}

export interface DescribeWorkerLoadFailureParams {
  scriptUrl: string
  reload: WorkerScriptReload
  recovery: WorkerRecovery
}

export function describeWorkerLoadFailure({
  scriptUrl,
  reload,
  recovery,
}: DescribeWorkerLoadFailureParams): string {
  const outcome =
    reload.kind === 'network-error'
      ? `failed with ${reload.message}`
      : `returned ${reload.status} (${reload.contentType ?? 'no content type'}, ${reload.byteLength} bytes)`
  return `The diffs worker script failed to load, and a refetch of ${scriptUrl} ${outcome}. ${describePage()}${RecoveryDescriptions[recovery]}`
}

function describePage(): string {
  return `The page was open for ${Math.round(performance.now() / 1000)} s, and navigator.onLine is ${navigator.onLine}.`
}
