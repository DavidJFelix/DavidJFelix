export interface StateStoreSettings {
  url: string
  authToken: string
}

/**
 * Resolve the state-store connection from the runtime environment
 * (`ALCHEMY_STATE_URL` + `ALCHEMY_STATE_TOKEN`). Returns undefined when
 * unconfigured so routes can render setup instructions instead of erroring --
 * that keeps the smoke gate secret-free.
 */
export const resolveStateStoreSettings = (
  env: Record<string, string | undefined>,
): StateStoreSettings | undefined => {
  const url = env.ALCHEMY_STATE_URL?.trim()
  const authToken = env.ALCHEMY_STATE_TOKEN?.trim()
  if (!url || !authToken) return undefined
  return {url, authToken}
}
