// A `Worker` reports a failure with an `error` event. Chromium sends a plain `Event`, with no
// message, when it cannot fetch the worker script (an error status or a network error). It sends an
// `ErrorEvent` when the script throws. In a classic worker, a script that is not JavaScript throws.

type WorkerFailureFetch = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>

const REFETCH_TIMEOUT_MS = 5000

export interface DescribeWorkerFailureParams {
  event: Event
  scriptUrl: string
  fetch?: WorkerFailureFetch
}

export async function describeWorkerFailure({
  event,
  scriptUrl,
  fetch: fetcher = fetch,
}: DescribeWorkerFailureParams): Promise<string> {
  const failure =
    event instanceof ErrorEvent
      ? `The diffs worker threw at ${event.filename}:${event.lineno}:${event.colno}: ${event.message}.`
      : `The diffs worker script failed to load, and a refetch of ${scriptUrl} ${await refetchScript(scriptUrl, fetcher)}.`
  return `${failure} The page was open for ${Math.round(performance.now() / 1000)} s, and navigator.onLine is ${navigator.onLine}.`
}

// The plain `Event` has no status or cause, so a second request is the only way to see what the
// server returns for the script.
async function refetchScript(scriptUrl: string, fetcher: WorkerFailureFetch): Promise<string> {
  try {
    const response = await fetcher(scriptUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(REFETCH_TIMEOUT_MS),
    })
    await response.body?.cancel()
    return `returned ${response.status} (${response.headers.get('content-type') ?? 'no content type'})`
  } catch (error) {
    return `failed with ${String(error)}`
  }
}
