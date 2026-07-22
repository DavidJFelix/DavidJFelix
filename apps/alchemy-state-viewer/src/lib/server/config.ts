import type {FetchLike} from '$lib/server/state-api'

export interface StateStoreSettings {
  url: string
  authToken: string
  /** Set on the deployed path: requests go through the service binding. */
  fetch?: FetchLike
}

/** The runtime shape of a `secrets_store_secrets` worker binding. */
export interface SecretsStoreSecretBinding {
  get: () => Promise<string>
}

export interface ResolveStateStoreSettingsParams {
  /** String environment ($env/dynamic/private): ALCHEMY_STATE_URL + optional dev token. */
  env: Record<string, string | undefined>
  /** platform.env from the cloudflare adapter, carrying the Secrets Store binding. */
  platformEnv?: Record<string, unknown>
}

const isSecretBinding = (value: unknown): value is SecretsStoreSecretBinding =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as SecretsStoreSecretBinding).get === 'function'

const stringValue = (key: string, params: ResolveStateStoreSettingsParams): string | undefined => {
  const fromEnv = params.env[key]?.trim()
  if (fromEnv) return fromEnv
  const fromPlatform = params.platformEnv?.[key]
  if (typeof fromPlatform === 'string' && fromPlatform.trim()) return fromPlatform.trim()
  return undefined
}

const isFetcherBinding = (value: unknown): value is {fetch: FetchLike} =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as {fetch: unknown}).fetch === 'function'

/**
 * Resolve the state-store connection. The URL comes from the
 * `ALCHEMY_STATE_URL` var (committed in wrangler.toml; overridable via env).
 * The bearer token prefers the `ALCHEMY_STATE_TOKEN` string env (local dev
 * via .dev.vars), then falls back to the `ALCHEMY_STATE_TOKEN_SECRET`
 * Secrets Store binding -- the deployed path, which reads the token alchemy
 * already keeps in the account Secrets Store without ever copying its value
 * into this worker.
 *
 * On the deployed path, requests are routed through the
 * `ALCHEMY_STATE_STORE` service binding: same-zone worker-to-worker global
 * fetch is blocked by Cloudflare (error 1042), and the binding stays inside
 * Cloudflare anyway. The dev path (string token) keeps global fetch, which
 * works from outside Cloudflare.
 *
 * Both process env and platform env are consulted for the strings: wrangler
 * serves vars/.dev.vars through the platform env, while `vite dev` and the
 * smoke gate see plain process env.
 *
 * Returns undefined when unconfigured so routes can render setup
 * instructions instead of erroring -- that keeps the smoke gate secret-free.
 */
export const resolveStateStoreSettings = async (
  params: ResolveStateStoreSettingsParams,
): Promise<StateStoreSettings | undefined> => {
  const url = stringValue('ALCHEMY_STATE_URL', params)
  if (!url) return undefined
  const envToken = stringValue('ALCHEMY_STATE_TOKEN', params)
  if (envToken) return {url, authToken: envToken}
  const binding = params.platformEnv?.ALCHEMY_STATE_TOKEN_SECRET
  if (isSecretBinding(binding)) {
    const authToken = (await binding.get()).trim()
    if (authToken) {
      const store = params.platformEnv?.ALCHEMY_STATE_STORE
      if (isFetcherBinding(store)) {
        return {url, authToken, fetch: (input, init) => store.fetch(input, init)}
      }
      return {url, authToken}
    }
  }
  return undefined
}
