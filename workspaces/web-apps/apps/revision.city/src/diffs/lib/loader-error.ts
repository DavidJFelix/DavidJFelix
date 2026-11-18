const UPSTREAM_FAILURE_STATUS = 502

export interface CreateLoaderErrorParams {
  message: string
  // The HTTP status that the file endpoint answers with, if it is a 4xx.
  status: number
}

// The status goes in the `cause`, so the message stays the text that the viewer shows.
export function createLoaderError({message, status}: CreateLoaderErrorParams): Error {
  return new Error(message, {cause: {status}})
}

// Gives the 4xx status that a loader error carries. All other errors give 502.
export function getLoaderErrorStatus(error: unknown): number {
  const status = error instanceof Error ? readCauseStatus(error.cause) : undefined
  return status !== undefined && status >= 400 && status < 500 ? status : UPSTREAM_FAILURE_STATUS
}

function readCauseStatus(cause: unknown): number | undefined {
  if (typeof cause !== 'object' || cause === null || !('status' in cause)) {
    return undefined
  }
  return typeof cause.status === 'number' ? cause.status : undefined
}
