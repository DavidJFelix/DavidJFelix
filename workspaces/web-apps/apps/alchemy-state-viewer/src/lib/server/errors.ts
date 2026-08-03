import {error} from '@sveltejs/kit'
import {StateApiError} from '$lib/server/state-api'

/**
 * Convert a state-store failure into a SvelteKit HTTP error: upstream auth
 * problems and unreachability surface as 502 with the client's message,
 * anything else rethrows untouched.
 */
export const rethrowAsHttpError = (cause: unknown): never => {
  if (cause instanceof StateApiError) {
    error(502, cause.message)
  }
  throw cause
}
