// Minimal fetch client for the alchemy Cloudflare state store's HTTP API
// (alchemy-effect packages/alchemy/src/State/HttpStateApi.ts). Read-only by
// design: this app never exposes the store's PUT/DELETE surface.
import type {PersistedStateView} from '$lib/state'

/** The slice of fetch this client uses; keeps test stubs cast-free. */
export type FetchLike = (
  input: string | URL,
  init?: {headers?: Record<string, string>},
) => Promise<Response>

export interface StateApiConfig {
  /** Base URL of the deployed state store worker, without a trailing slash. */
  url: string
  /** Bearer token minted by the alchemy bootstrap for this store. */
  authToken: string
  /** Injectable for tests; defaults to global fetch. */
  fetch?: FetchLike
}

export class StateApiError extends Error {
  readonly status: number | undefined

  constructor(params: {message: string; status?: number; cause?: unknown}) {
    super(params.message, params.cause === undefined ? undefined : {cause: params.cause})
    this.name = 'StateApiError'
    this.status = params.status
  }
}

export interface StateApi {
  getVersion: () => Promise<number>
  listStacks: () => Promise<string[]>
  listStages: (stack: string) => Promise<string[]>
  listResources: (stack: string, stage: string) => Promise<string[]>
  getResource: (
    stack: string,
    stage: string,
    fqn: string,
  ) => Promise<PersistedStateView | undefined>
  getStackOutput: (stack: string, stage: string) => Promise<unknown>
}

const trimTrailingSlash = (url: string): string => url.replace(/\/+$/u, '')

const stagePath = (stack: string, stage: string): string =>
  `/state/stacks/${encodeURIComponent(stack)}/stages/${encodeURIComponent(stage)}`

interface ResolvedConfig {
  baseUrl: string
  authToken: string
  fetchImpl: FetchLike
}

const getJson = async (
  {baseUrl, authToken, fetchImpl}: ResolvedConfig,
  path: string,
): Promise<unknown> => {
  let response: Response
  try {
    response = await fetchImpl(`${baseUrl}${path}`, {
      headers: {
        authorization: `Bearer ${authToken}`,
        accept: 'application/json',
      },
    })
  } catch (cause) {
    throw new StateApiError({message: `State store unreachable at ${baseUrl}`, cause})
  }
  if (response.status === 401 || response.status === 403) {
    throw new StateApiError({
      message: 'State store rejected the token (check ALCHEMY_STATE_TOKEN)',
      status: response.status,
    })
  }
  if (!response.ok) {
    throw new StateApiError({
      message: `State store request failed: GET ${path} -> HTTP ${response.status}`,
      status: response.status,
    })
  }
  const body = await response.text()
  if (body === '') return undefined
  try {
    return JSON.parse(body) as unknown
  } catch (cause) {
    throw new StateApiError({message: `State store returned invalid JSON for GET ${path}`, cause})
  }
}

export const createStateApi = (config: StateApiConfig): StateApi => {
  const resolved: ResolvedConfig = {
    baseUrl: trimTrailingSlash(config.url),
    authToken: config.authToken,
    fetchImpl: config.fetch ?? fetch,
  }
  const get = (path: string): Promise<unknown> => getJson(resolved, path)

  return {
    getVersion: async () => {
      const body = await get('/version')
      const version = (body as {version?: unknown} | undefined)?.version
      if (typeof version !== 'number') {
        throw new StateApiError({message: 'State store /version returned an unexpected shape'})
      }
      return version
    },
    listStacks: async () => asStringArray(await get('/state/stacks')),
    listStages: async (stack) =>
      asStringArray(await get(`/state/stacks/${encodeURIComponent(stack)}/stages`)),
    listResources: async (stack, stage) =>
      asStringArray(await get(`${stagePath(stack, stage)}/resources`)),
    getResource: async (stack, stage, fqn) => {
      const body = await get(`${stagePath(stack, stage)}/resources/${encodeURIComponent(fqn)}`)
      if (body === undefined || body === null) return
      return body as PersistedStateView
    },
    getStackOutput: async (stack, stage) => {
      const body = await get(`${stagePath(stack, stage)}/output`)
      return body === null ? undefined : body
    },
  }
}

const asStringArray = (body: unknown): string[] => {
  if (!Array.isArray(body) || body.some((entry) => typeof entry !== 'string')) {
    throw new StateApiError({
      message: 'State store returned an unexpected shape (expected string[])',
    })
  }
  return body as string[]
}

/**
 * Map over items with bounded concurrency, preserving order. Keeps per-stage
 * resource fan-out well under the Workers subrequest ceiling.
 */
export const mapWithConcurrency = async <T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = []
  let next = 0
  const worker = async (): Promise<void> => {
    const index = next
    next += 1
    if (index >= items.length) return
    results[index] = await mapper(items[index] as T)
    return worker()
  }
  const workerCount = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({length: workerCount}, () => worker()))
  return results
}
