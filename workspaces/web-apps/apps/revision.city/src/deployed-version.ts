// The id of the Worker version serving this request, from the version
// metadata binding wrangler.toml declares, for the share card routes'
// `version`. Undefined where the binding is absent or empty.
export async function readDeployedVersion(): Promise<string | undefined> {
  // Dynamic import: `cloudflare:workers` only resolves in the workerd SSR
  // environment, and this keeps it out of the client bundle entirely.
  const {env} = await import('cloudflare:workers')
  const id: unknown = Reflect.get(env.CF_VERSION_METADATA ?? {}, 'id')
  return typeof id === 'string' && id !== '' ? id : undefined
}
