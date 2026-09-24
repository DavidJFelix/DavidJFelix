// The id of the Worker version serving this request, from the version
// metadata binding wrangler.toml declares. The share-card routes key their
// edge cache on it, so a deploy starts from an empty card cache instead of
// serving the previous version's cards until they expire. Undefined where the
// binding is absent or empty, and a caller then keys nothing on it.
export async function readDeployedVersion(): Promise<string | undefined> {
  // Dynamic import: `cloudflare:workers` only resolves in the workerd SSR
  // environment, and this keeps it out of the client bundle entirely.
  const {env} = await import('cloudflare:workers')
  const id: unknown = Reflect.get(env.CF_VERSION_METADATA ?? {}, 'id')
  return typeof id === 'string' && id !== '' ? id : undefined
}
